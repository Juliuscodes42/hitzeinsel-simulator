"""
Bereitet die Starkregenwerte KOSTRA-DWD-2020 des Deutschen Wetterdienstes für die App auf.

Quelle: DWD Climate Data Center, KOSTRA-DWD-2020, Dauerstufe 60 Minuten.
Lizenz: CC BY 4.0 (https://www.dwd.de/copyright).

Aufruf (im Projektordner):  python scripts/build-kostra.py
Ergebnis: src/data/kostra.json

Das Raster hat 300 × 300 Zellen à 5 km in der Projektion ETRS89-LAEA (EPSG:3035).
Gespeichert wird je Wiederkehrzeit eine Zeichenkette mit einem Zeichen pro Zelle,
Zeile für Zeile von Norden nach Süden: Zeichen = chr(35 + Regenhöhe in ganzen mm),
"!" = keine Daten (außerhalb Deutschlands). So bleibt die Datei klein.
"""

import io
import json
import urllib.request
import zipfile
from pathlib import Path

URL = (
    'https://opendata.dwd.de/climate_environment/CDC/grids_germany/return_periods/'
    'precipitation/KOSTRA/KOSTRA_DWD_2020/asc/StatRR_KOSTRA-DWD-2020_D00060_ASC.zip'
)
RETURN_PERIODS = [5, 30, 100]
OFFSET = 35
NODATA_CHAR = '!'


def parse_ascii_grid(text: str):
    lines = text.splitlines()
    header = {}
    for line in lines[:6]:
        key, value = line.split()
        header[key.lower()] = float(value)
    rows = [[float(v) for v in line.split()] for line in lines[6:] if line.strip()]
    return header, rows


def main() -> None:
    print('Lade KOSTRA-DWD-2020 (60 Minuten) …')
    with urllib.request.urlopen(URL, timeout=120) as response:
        archive = zipfile.ZipFile(io.BytesIO(response.read()))

    result = {
        'source': 'KOSTRA-DWD-2020, Deutscher Wetterdienst, CC BY 4.0',
        'durationMin': 60,
        'returnPeriods': {},
    }
    for period in RETURN_PERIODS:
        name = f'Hn_KOSTRA-DWD-2020_D00060_T{period:03d}.asc'
        header, rows = parse_ascii_grid(archive.read(name).decode('ascii'))
        result.update(
            ncols=int(header['ncols']),
            nrows=int(header['nrows']),
            xllcorner=header['xllcorner'],
            yllcorner=header['yllcorner'],
            cellsize=header['cellsize'],
        )
        chars = []
        values = []
        for row in rows:
            for value in row:
                if value == header['nodata_value']:
                    chars.append(NODATA_CHAR)
                else:
                    mm = round(value)
                    assert 0 <= mm <= 126 - OFFSET, f'Wert {value} passt nicht in die Kodierung'
                    chars.append(chr(OFFSET + mm))
                    values.append(value)
        assert len(chars) == result['ncols'] * result['nrows']
        result['returnPeriods'][str(period)] = ''.join(chars)
        print(f'  alle {period} Jahre: {min(values):.1f} bis {max(values):.1f} mm')

    target = Path(__file__).resolve().parent.parent / 'src' / 'data' / 'kostra.json'
    target.write_text(json.dumps(result, separators=(',', ':')) + '\n', encoding='utf-8')
    print(f'Gespeichert: {target} ({target.stat().st_size // 1024} KB)')


if __name__ == '__main__':
    main()
