import { defineMessages } from './i18n'

/**
 * De namen van kleuren en effecten voor het MagicHome-licht (issue #53), voor de app en de
 * telefoon. De sleutels zijn vast: `light-effects.ts` en `light.ts` rekenen ermee, de namen staan
 * alleen hier.
 */
export const LIGHT_MESSAGES = defineMessages(
  {
    off: 'Uit',
    effectNumber: 'Effect {number}',
    /** Een effect uit een raster, bv. "Rennend punt, rood, naar buiten". */
    effectInGrid: '{group}, {color}, {direction}',

    'color.black': 'Zwart',
    'color.red': 'Rood',
    'color.orange': 'Oranje',
    'color.yellow': 'Geel',
    'color.green': 'Groen',
    'color.cyan': 'Cyaan',
    'color.blue': 'Blauw',
    'color.purple': 'Paars',
    'color.pink': 'Roze',
    'color.white': 'Wit',
    'color.warmWhite': 'Warm wit',

    'group.basics': 'Basis',
    'group.runningDot': 'Rennend punt',
    'group.fill': 'Opvullen',
    'group.fadingDot': 'Vervagend punt',
    'group.chase': 'Looplicht',
    'group.dotByDot': 'Kleuren punt voor punt',
    'group.colorBlocks': 'Kleuren in blokken',
    'group.fadeInColor': 'Vervagen in een kleur',
    'group.blocksInColor': 'Blokken in een kleur',
    'group.flowing': 'Vloeiend',
    'group.running': 'Lopend',
    'group.combinations': 'Combinaties',
    'group.other': 'Overig',

    'gridLabel.background': 'Achtergrond',
    'gridLabel.color': 'Kleur',

    'direction.backAndForth': 'Heen en weer',
    'direction.forward': 'Vooruit',
    'direction.backward': 'Achteruit',
    'direction.outAndBack': 'Naar buiten en terug',
    'direction.outward': 'Naar buiten',
    'direction.inward': 'Naar binnen',

    'basic.1': 'Alle effecten na elkaar',
    'basic.2': 'Kleuren lopen in elkaar over',
    'basic.3': 'Looplicht in kleur',
    'basic.4': 'Kleuren wisselen snel',
    'basic.5': 'Flitsen in kleur',
    'basic.6': 'Eén punt heen en weer',
    'basic.7': 'Meerdere punten heen en weer',
    'basic.8': 'Opvullen heen en weer',
    'basic.9': 'Opvullen vanuit het midden',
    'basic.10': 'Regenboog heen en weer',
    'basic.11': 'Lichtspoor heen en weer',
    'basic.12': 'Looplicht heen en weer',
    'basic.13': 'Lichtspoor vanuit wit',

    /** Delen van een combinatie, bv. "Vloeien + flitsen"; klein, de eerste krijgt een hoofdletter. */
    'part.flow': 'vloeien',
    'part.chase': 'looplicht',
    'part.quickChange': 'snel wisselen',
    'part.flash': 'flitsen'
  },
  {
    en: {
      off: 'Off',
      effectNumber: 'Effect {number}',
      effectInGrid: '{group}, {color}, {direction}',

      'color.black': 'Black',
      'color.red': 'Red',
      'color.orange': 'Orange',
      'color.yellow': 'Yellow',
      'color.green': 'Green',
      'color.cyan': 'Cyan',
      'color.blue': 'Blue',
      'color.purple': 'Purple',
      'color.pink': 'Pink',
      'color.white': 'White',
      'color.warmWhite': 'Warm white',

      'group.basics': 'Basics',
      'group.runningDot': 'Running dot',
      'group.fill': 'Fill',
      'group.fadingDot': 'Fading dot',
      'group.chase': 'Chase',
      'group.dotByDot': 'Colours dot by dot',
      'group.colorBlocks': 'Colour blocks',
      'group.fadeInColor': 'Fade in one colour',
      'group.blocksInColor': 'Blocks in one colour',
      'group.flowing': 'Flowing',
      'group.running': 'Running',
      'group.combinations': 'Combinations',
      'group.other': 'Other',

      'gridLabel.background': 'Background',
      'gridLabel.color': 'Colour',

      'direction.backAndForth': 'Back and forth',
      'direction.forward': 'Forward',
      'direction.backward': 'Backward',
      'direction.outAndBack': 'Outward and back',
      'direction.outward': 'Outward',
      'direction.inward': 'Inward',

      'basic.1': 'All effects in turn',
      'basic.2': 'Colours blend into each other',
      'basic.3': 'Colour chase',
      'basic.4': 'Colours change quickly',
      'basic.5': 'Colour flash',
      'basic.6': 'One dot back and forth',
      'basic.7': 'Several dots back and forth',
      'basic.8': 'Fill back and forth',
      'basic.9': 'Fill from the middle',
      'basic.10': 'Rainbow back and forth',
      'basic.11': 'Light trail back and forth',
      'basic.12': 'Chase back and forth',
      'basic.13': 'Light trail from white',

      'part.flow': 'flow',
      'part.chase': 'chase',
      'part.quickChange': 'quick change',
      'part.flash': 'flash'
    }
  }
)

export type LightMessage = keyof (typeof LIGHT_MESSAGES)['messages']['nl']
