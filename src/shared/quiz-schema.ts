import { z } from 'zod'
import { SCHEMA_VERSION } from './version'

export { SCHEMA_VERSION }

const id = z.string().min(1)
const unit = z.number().min(0).max(1)
const seconds = z.number().min(0)

export const MediaKindSchema = z.enum(['video', 'audio', 'image'])

/** Map in de mediabibliotheek. Alleen een indeling in de quiz; op schijf staat alles in `media/`. */
export const MediaFolderSchema = z.object({
  id,
  name: z.string()
})

export const MediaAssetSchema = z.object({
  id,
  kind: MediaKindSchema,
  /** Pad relatief aan de quizmap, bv. `media/3f9a1c….mp4`. */
  file: z.string().min(1),
  /** Oorspronkelijke bestandsnaam, voor weergave. */
  name: z.string(),
  duration: seconds.optional(),
  folderId: id.optional()
})

export const ScreenContentSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('video'),
    assetId: id,
    /** Volume van het geluid van de video, via de speakers van het scherm; ontbreekt = stil. */
    volume: unit.optional()
  }),
  z.object({ type: z.literal('image'), assetId: id }),
  z.object({ type: z.literal('black') })
])

export const ScreenSlotSchema = z.object({
  id,
  name: z.string(),
  default: ScreenContentSchema
})

export const AudioChannelSchema = z.object({
  id,
  name: z.string(),
  volume: unit
})

export const BackgroundSchema = z.object({
  assetId: id,
  channelId: id,
  volume: unit,
  /** Fractie van het normale volume tijdens ducking. */
  duckTo: unit
})

export const FragmentSchema = z.object({
  id,
  label: z.string(),
  assetId: id,
  channelId: id,
  start: seconds.optional(),
  end: seconds.optional(),
  fadeIn: seconds.optional(),
  fadeOut: seconds.optional(),
  answer: z.string().optional(),
  /** Getoond bij het antwoord in de antwoordenronde, bv. de albumhoes. */
  answerImageAssetId: id.optional()
})

export const SlideBackdropSchema = z.union([
  z.literal('over-video'),
  z.literal('dim'),
  z.object({ color: z.string() })
])

export const SlideSchema = z.object({
  id,
  layout: z.enum(['title', 'question', 'number', 'image']),
  title: z.string().optional(),
  body: z.string().optional(),
  imageAssetId: id.optional(),
  targetScreens: z.union([z.literal('all'), z.array(id)]),
  backdrop: SlideBackdropSchema,
  /** Vraagslide met alleen het nummer in beeld: de quizmaster leest de vraag zelf voor. */
  numberOnly: z.boolean().optional(),
  /** Voor de antwoordenronde (vraag-, nummer- en afbeeldingsslides). */
  answer: z.string().optional(),
  /** Afbeelding die bij het antwoord de vraag vervangt, bv. de hele foto na een uitsnede. */
  answerImageAssetId: id.optional()
})

export const RoundBackgroundSchema = z.union([
  z.enum(['continue', 'duck', 'pause']),
  z.object({ replaceAssetId: id })
])

export const AutoplaySettingsSchema = z.object({
  gapSeconds: seconds,
  /** Aftellen tussen fragmenten, op dezelfde schermen als het fragmentnummer. */
  countdownOnScreen: z.boolean()
})

export const RoundSchema = z.object({
  id,
  title: z.string(),
  hostNotes: z.string().optional(),
  /** Alleen afwijkingen van de standaard; een ontbrekend scherm toont zijn standaard. */
  screens: z.record(z.string(), ScreenContentSchema),
  /** Schermen die hun standaard tonen, maar zonder videogeluid tijdens deze ronde. */
  mutedScreens: z.array(id).default([]),
  /** Schermen die het nummer tonen van het fragment dat speelt (handmatig of in de reeks). */
  fragmentScreens: z.array(id),
  /** Antwoordenronde: rondes waarvan je hier de fragmenten met hun antwoord langsloopt. */
  answersFor: z.array(id).default([]),
  /** Slides (na de titel) wisselen vanzelf elke zoveel seconden, eindeloos; null = handmatig. */
  slideLoopSeconds: z.number().min(1).nullable().default(null),
  slides: z.array(SlideSchema),
  background: RoundBackgroundSchema,
  fragments: z.array(FragmentSchema),
  autoplay: AutoplaySettingsSchema
})

export const QuizSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  title: z.string(),
  /** Ontbreekt in quizzen van vóór de mappen; dan leeg. */
  folders: z.array(MediaFolderSchema).default([]),
  assets: z.array(MediaAssetSchema),
  screens: z.array(ScreenSlotSchema),
  channels: z.array(AudioChannelSchema),
  background: BackgroundSchema.nullable(),
  rounds: z.array(RoundSchema)
})
