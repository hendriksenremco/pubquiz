import type { Directive } from 'vue'

/** Zet --fill op het deel van de baan tot de waarde; base.css kleurt dat stuk amber. */
function update(el: HTMLInputElement) {
  const min = Number(el.min || 0)
  const max = Number(el.max || 100)
  const ratio = max > min ? (Number(el.value) - min) / (max - min) : 0
  el.style.setProperty('--fill', `${Math.min(1, Math.max(0, ratio)) * 100}%`)
}

/** Voor <input type="range">: de baan vult zich tot de waarde, ook als die van buitenaf verandert. */
export const vFill: Directive<HTMLInputElement> = {
  mounted(el) {
    update(el)
    el.addEventListener('input', () => update(el))
  },
  updated: update
}
