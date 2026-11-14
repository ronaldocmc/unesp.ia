"""Export public IBGE polygons with audited GEOS topology repair (Shapely 2.1.2)."""
import csv
import hashlib
import io
import json
import sys
from pathlib import Path
import shapely
from shapely.geometry import shape, mapping, MultiPolygon, box
from shapely.validation import explain_validity

rows = json.loads(sys.stdin.buffer.read().decode('utf-8'))
assert len(rows) == 5570
assert len({str(row[0]) for row in rows}) == 5570
out = io.StringIO(newline='')
writer = csv.writer(out, lineterminator='\n')
writer.writerow(['codigo_ibge', 'nome', 'uf', 'geojson'])
repairs = []

def polygons(geom):
    if geom.geom_type == 'Polygon':
        return [geom]
    if hasattr(geom, 'geoms'):
        return [p for child in geom.geoms for p in polygons(child)]
    return []  # collapsed lines/points have no municipal area

for code, name, state, bounds, coordinates in rows:
    geom = shape({'type': 'MultiPolygon', 'coordinates': coordinates})
    if not geom.is_valid:
        reason = explain_validity(geom)
        fixed = MultiPolygon(polygons(shapely.make_valid(geom, method='linework')))
        delta = abs(fixed.area - geom.area)
        if delta > max(1e-8, abs(geom.area) * 0.001):
            raise ValueError(f'{code}: repair changes area too much: {delta}')
        repairs.append({'codigo_ibge': str(code), 'nome': name, 'motivo': reason,
                        'area_delta_graus2': delta})
        geom = fixed
    assert geom.is_valid and not geom.is_empty and geom.geom_type == 'MultiPolygon', code
    assert all(-180 <= x <= 180 for x in (geom.bounds[0], geom.bounds[2])), code
    assert all(-90 <= y <= 90 for y in (geom.bounds[1], geom.bounds[3])), code
    writer.writerow([code, name, state, json.dumps(mapping(geom), separators=(',', ':'))])

text = out.getvalue()
loaded = list(csv.DictReader(io.StringIO(text)))
assert len(loaded) == 5570
for row in loaded:
    geom = shape(json.loads(row['geojson']))
    assert geom.is_valid and not geom.is_empty
pirapozinho = next(row for row in loaded if row['codigo_ibge'] == '3539202')
assert pirapozinho['nome'] == 'Pirapozinho'
assert shape(json.loads(pirapozinho['geojson'])).contains(box(-51.505001, -22.285001, -51.494999, -22.274999))
directory = Path(__file__).resolve().parents[1] / 'supabase' / 'data'
directory.mkdir(parents=True, exist_ok=True)
data = text.encode('utf-8')
(directory / 'ibge-municipios-2022.csv').write_bytes(data)
report = {'total': len(loaded), 'invalidas_apos_reparo': 0, 'shapely': shapely.__version__,
          'geos': shapely.geos_version_string, 'metodo': 'make_valid linework; polygonal components only',
          'sha256_csv': hashlib.sha256(data).hexdigest(), 'reparos': repairs}
(directory / 'ibge-municipios-2022-validacao.json').write_text(json.dumps(report, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
print(f'CSV validado: {len(loaded)} municipios; {len(repairs)} geometrias reparadas; Pirapozinho verificado.')
