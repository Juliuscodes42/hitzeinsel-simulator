/** Lage eines selbst hochgeladenen Bilds unter dem Raster. */
export interface ImageAlignment {
  /** Vergrößerung, 1 = Bild füllt das Raster genau. */
  scale: number
  /** Verschiebung in Prozent der Rasterbreite bzw. -höhe. */
  offsetX: number
  offsetY: number
  /** Drehung in Grad im Uhrzeigersinn. */
  rotation: number
}

export const DEFAULT_ALIGNMENT: ImageAlignment = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 }
