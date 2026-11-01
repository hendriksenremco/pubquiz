import { defineMessages } from '@shared/i18n'

/**
 * De teksten van het licht met de hand kiezen (LightPanel), op de telefoon en in de werkbalk van
 * de show. Dezelfde namen op allebei.
 */
export const LIGHT_PANEL_MESSAGES = defineMessages(
  {
    light: 'Licht',
    chooseByHand: 'Het licht met de hand kiezen',
    followShow: 'Volg de show',
    manual: 'Met de hand gekozen, tot de show een ander licht kiest',
    following: 'Volgt de show',
    notDriven: 'De show stuurt het licht nu niet aan',
    notDrivenShort: 'Niet aangestuurd',
    inThisQuiz: 'In deze quiz',
    color: 'Kleur',
    effect: 'Effect'
  },
  {
    en: {
      light: 'Lights',
      chooseByHand: 'Choose the lights by hand',
      followShow: 'Follow the show',
      manual: 'Chosen by hand, until the show picks other lights',
      following: 'Following the show',
      notDriven: "The show isn't controlling the lights right now",
      notDrivenShort: 'Not controlled',
      inThisQuiz: 'In this quiz',
      color: 'Colour',
      effect: 'Effect'
    }
  }
)

/** De eigen teksten van het veld om het licht te kiezen (LightPicker). */
export const LIGHT_PICKER_MESSAGES = defineMessages(
  {
    color: 'Kleur',
    effect: 'Effect',
    off: 'Uit',
    customColor: 'Eigen kleur',
    customColorCode: 'Eigen kleurcode',
    speed: 'Snelheid',
    previewOnLamp: 'Voorbeeld op de lamp',
    liveFollowsShow: 'Tijdens de show volgt de lamp de show.',
    noAddress: 'Vul eerst het adres van de controller in bij Instellingen.',
    /** De tooltip van het veld, bv. "Licht in deze ronde: Rood". */
    title: '{label}: {value}',
    /** Zonder eigen licht, met wat er dan brandt: "Licht bij deze slide: Zoals de ronde (Rood)". */
    titleInherited: '{label}: {value} ({fallback})'
  },
  {
    en: {
      color: 'Colour',
      effect: 'Effect',
      off: 'Off',
      customColor: 'Custom colour',
      customColorCode: 'Custom colour code',
      speed: 'Speed',
      previewOnLamp: 'Preview on the lamp',
      liveFollowsShow: 'During the show, the lamp follows the show.',
      noAddress: 'First enter the address of the controller in Settings.',
      title: '{label}: {value}',
      titleInherited: '{label}: {value} ({fallback})'
    }
  }
)

/** Het licht op zijn plekken in de app: bij de quiz, een ronde, een slide en bij Show starten. */
export const LIGHT_PLACE_MESSAGES = defineMessages(
  {
    light: 'Licht',
    quizDefault: 'Standaard',
    quizLabel: 'Standaard licht',
    quizInherit: 'Geen',
    quizInheritText: 'Niet aansturen',
    roundLabel: 'Licht in deze ronde',
    roundInherit: 'Standaard',
    roundInheritText: 'Standaard',
    slideLabel: 'Licht bij deze slide',
    slideInherit: 'Ronde',
    slideInheritText: 'Zoals de ronde'
  },
  {
    en: {
      light: 'Lights',
      quizDefault: 'Default',
      quizLabel: 'Default lights',
      quizInherit: 'None',
      quizInheritText: "Don't control",
      roundLabel: 'Lights in this round',
      roundInherit: 'Default',
      roundInheritText: 'Default',
      slideLabel: 'Lights on this slide',
      slideInherit: 'Round',
      slideInheritText: 'Same as the round'
    }
  }
)

/** Het adres van de controller met de testknop (ControllerAddress). */
export const CONTROLLER_MESSAGES = defineMessages(
  {
    placeholder: 'IP-adres van de controller',
    ariaLabel: 'IP-adres van de MagicHome-controller',
    test: 'Test',
    testing: 'Testen…',
    noAddress: 'Zonder adres blijft het licht zoals het is.',
    connectedOff: 'Verbonden. Het licht staat uit.',
    connectedNow: 'Verbonden. Nu: {now}.'
  },
  {
    en: {
      placeholder: 'IP address of the controller',
      ariaLabel: 'IP address of the MagicHome controller',
      test: 'Test',
      testing: 'Testing…',
      noAddress: 'Without an address, the lights stay as they are.',
      connectedOff: 'Connected. The lights are off.',
      connectedNow: 'Connected. Now: {now}.'
    }
  }
)
