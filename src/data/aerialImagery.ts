/**
 * Amtliche Luftbilder (Digitale Orthophotos, DOP) der 16 Bundesländer.
 *
 * Alle Länder bieten ihre Luftbilder kostenlos als WMS-Dienst an, meist mit
 * 20 cm Bodenauflösung und einer offenen Lizenz (CC BY 4.0 oder Datenlizenz
 * Deutschland). Anders als bei kommerziellen Luftbildern dürfen die Bildpunkte
 * deshalb ausgewertet werden, was für die Bilderkennung nötig ist.
 *
 * Geprüft am 21.11.2026: Alle Dienste liefern Bilder im Koordinatensystem
 * EPSG:4326 und erlauben den Abruf aus dem Browser (CORS).
 */

import type { BBox } from '../model/osm.ts'

export interface ImageryService {
  /** Bundesland */
  state: string
  url: string
  layer: string
  /** Quellenvermerk, wie ihn die Lizenz verlangt. */
  attribution: string
}

/** Dienste nach ISO-Kürzel des Landes (DE-SH, DE-NW, …). */
export const DOP_SERVICES: Record<string, ImageryService> = {
  'DE-SH': {
    state: 'Schleswig-Holstein',
    url: 'https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD',
    layer: 'sh_dop20_rgb',
    attribution: 'Luftbild: © GeoBasis-DE/LVermGeo SH (CC BY 4.0)',
  },
  'DE-HH': {
    state: 'Hamburg',
    url: 'https://geodienste.hamburg.de/wms_dop_zeitreihe_belaubt',
    layer: 'dop_zeitreihe_belaubt',
    attribution: 'Luftbild: Freie und Hansestadt Hamburg, LGV (dl-de/by-2-0)',
  },
  'DE-NI': {
    state: 'Niedersachsen',
    url: 'https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms',
    layer: 'ni_dop20',
    attribution: 'Luftbild: © LGLN (CC BY 4.0)',
  },
  'DE-HB': {
    state: 'Bremen',
    url: 'https://geodienste.bremen.de/wms_dop20_2023',
    layer: 'DOP20_2023_HB',
    attribution: 'Luftbild: Landesamt GeoInformation Bremen (CC BY)',
  },
  'DE-NW': {
    state: 'Nordrhein-Westfalen',
    url: 'https://www.wms.nrw.de/geobasis/wms_nw_dop',
    layer: 'nw_dop_rgb',
    attribution: 'Luftbild: © Geobasis NRW (dl-de/zero-2-0)',
  },
  'DE-HE': {
    state: 'Hessen',
    url: 'https://www.gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows',
    layer: 'he_dop20_rgb',
    attribution: 'Luftbild: © HVBG Hessen',
  },
  'DE-RP': {
    state: 'Rheinland-Pfalz',
    url: 'https://geo4.service24.rlp.de/wms/rp_dop20.fcgi',
    layer: 'rp_dop20',
    attribution: 'Luftbild: © GeoBasis-DE/LVermGeoRP (dl-de/by-2-0)',
  },
  'DE-SL': {
    state: 'Saarland',
    url: 'https://geoportal.saarland.de/freewms/dop2020',
    layer: 'sl_dop2020',
    attribution: 'Luftbild: © LVGL Saarland',
  },
  'DE-BW': {
    state: 'Baden-Württemberg',
    url: 'https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C',
    layer: 'IMAGES_DOP_20_RGB',
    attribution: 'Luftbild: © LGL BW, www.lgl-bw.de (dl-de/by-2-0)',
  },
  'DE-BY': {
    state: 'Bayern',
    url: 'https://geoservices.bayern.de/od/wms/dop/v1/dop40',
    layer: 'by_dop40c',
    attribution: 'Luftbild: © Bayerische Vermessungsverwaltung (CC BY 4.0)',
  },
  'DE-BE': {
    state: 'Berlin',
    url: 'https://gdi.berlin.de/services/wms/truedop_2024',
    layer: 'truedop_2024',
    attribution: 'Luftbild: Geoportal Berlin, TrueDOP 2024 (dl-de/zero-2-0)',
  },
  'DE-BB': {
    state: 'Brandenburg',
    url: 'https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms',
    layer: 'bebb_dop20c',
    attribution: 'Luftbild: © GeoBasis-DE/LGB (dl-de/by-2-0)',
  },
  'DE-MV': {
    state: 'Mecklenburg-Vorpommern',
    url: 'https://www.geodaten-mv.de/dienste/adv_dop',
    layer: 'mv_dop',
    attribution: 'Luftbild: © GeoBasis-DE/M-V',
  },
  'DE-SN': {
    state: 'Sachsen',
    url: 'https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest',
    layer: 'sn_dop_020',
    attribution: 'Luftbild: © GeoSN (dl-de/by-2-0)',
  },
  'DE-ST': {
    state: 'Sachsen-Anhalt',
    url: 'https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DOP_WMS_OpenData/guest',
    layer: 'lsa_lvermgeo_dop20_2',
    attribution: 'Luftbild: © GeoBasis-DE/LVermGeo ST (dl-de/by-2-0)',
  },
  'DE-TH': {
    state: 'Thüringen',
    url: 'https://www.geoproxy.geoportal-th.de/geoproxy/services/DOP',
    layer: 'th_dop',
    attribution: 'Luftbild: © GDI-Th (CC BY 4.0)',
  },
}

/** Kantenlänge des abgerufenen Bilds: 200 m / 1000 Bildpunkte = 20 cm je Bildpunkt. */
export const IMAGE_SIZE_PX = 1000

/** Adresse eines Luftbilds, das genau den Ausschnitt zeigt (WMS 1.1.1, Längen- und Breitengrade). */
export function dopImageUrl(service: ImageryService, bbox: BBox, sizePx = IMAGE_SIZE_PX): string {
  const params = new URLSearchParams({
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: service.layer,
    STYLES: '',
    SRS: 'EPSG:4326',
    BBOX: `${bbox.west},${bbox.south},${bbox.east},${bbox.north}`,
    WIDTH: String(sizePx),
    HEIGHT: String(sizePx),
    FORMAT: 'image/jpeg',
  })
  return `${service.url}?${params}`
}

/**
 * Bundesland eines Punkts als ISO-Kürzel (z. B. "DE-SH"), über die
 * Rückwärtssuche von Nominatim (OpenStreetMap). undefined = nicht in Deutschland.
 */
export async function stateAt(lat: number, lon: number): Promise<string | undefined> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse')
  url.searchParams.set('format', 'jsonv2')
  url.searchParams.set('zoom', '5')
  url.searchParams.set('lat', lat.toFixed(5))
  url.searchParams.set('lon', lon.toFixed(5))
  const response = await fetch(url, {
    headers: { 'Accept-Language': 'de' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) throw new Error(`Ortsbestimmung antwortet mit Fehler ${response.status}.`)
  const data = (await response.json()) as { address?: Record<string, string> }
  const code = data.address?.['ISO3166-2-lvl4']
  return code && code in DOP_SERVICES ? code : undefined
}

/** Bildpunkte eines Bilds (RGBA), geladen über ein Canvas. */
export interface ImagePixels {
  pixels: Uint8ClampedArray
  width: number
  height: number
}

/**
 * Lädt ein Bild und liest seine Bildpunkte. Klappt nur, wenn der Bilddienst
 * den Zugriff aus dem Browser erlaubt (CORS).
 */
export function loadImagePixels(url: string, timeoutMs = 45_000): Promise<ImagePixels> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    const timer = setTimeout(() => {
      image.src = ''
      reject(new Error('Der Luftbild-Dienst antwortet nicht.'))
    }, timeoutMs)
    image.onload = () => {
      clearTimeout(timer)
      try {
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Canvas nicht verfügbar.')
        context.drawImage(image, 0, 0)
        const data = context.getImageData(0, 0, canvas.width, canvas.height)
        resolve({ pixels: data.data, width: data.width, height: data.height })
      } catch (problem) {
        reject(problem instanceof Error ? problem : new Error(String(problem)))
      }
    }
    image.onerror = () => {
      clearTimeout(timer)
      reject(new Error('Das Luftbild konnte nicht geladen werden.'))
    }
    image.src = url
  })
}
