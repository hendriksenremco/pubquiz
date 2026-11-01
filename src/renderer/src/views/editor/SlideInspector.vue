<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Round, Slide } from '@shared/types'
import BackdropPicker from '../../components/BackdropPicker.vue'
import Icon from '../../components/Icon.vue'
import ImageChip from '../../components/ImageChip.vue'
import StagePreview from '../../components/StagePreview.vue'
import PluginSlot from '../../plugins/PluginSlot.vue'
import { locale } from '../../lib/locale'
import { useSession } from '../../stores/session'
import { SLIDE_MESSAGES } from './editor-messages'

/** Paneel rechts voor de gekozen slide: hoe hij eruitziet en waar hij komt. */
const props = defineProps<{ round: Round; slide: Slide }>()
const emit = defineEmits<{ select: [id: string | null] }>()
const session = useSession()
const t = SLIDE_MESSAGES.in(locale)
const quiz = computed(() => session.quiz!)
const screens = computed(() => quiz.value.screens)
const index = computed(() => props.round.slides.indexOf(props.slide))

const LAYOUTS: { value: Slide['layout']; label: string }[] = [
  { value: 'title', label: t('layoutTitle') },
  { value: 'question', label: t('layoutQuestion') },
  { value: 'number', label: t('layoutNumber') },
  { value: 'image', label: t('layoutImage') }
]

function targets(screenId: string): boolean {
  return props.slide.targetScreens === 'all' || props.slide.targetScreens.includes(screenId)
}

function toggleTarget(screenId: string) {
  const all = screens.value.map((x) => x.id)
  const current = props.slide.targetScreens === 'all' ? all : props.slide.targetScreens
  const next = current.includes(screenId)
    ? current.filter((id) => id !== screenId)
    : [...current, screenId]
  if (next.length === 0) return
  props.slide.targetScreens = next.length === all.length ? 'all' : next
}

// De preview toont het eerste scherm waar de slide op komt; met meer schermen kies je er een.
const previewId = ref<string | null>(null)
const previewScreen = computed(
  () =>
    screens.value.find((s) => s.id === previewId.value && targets(s.id)) ??
    screens.value.find((s) => targets(s.id)) ??
    null
)

function move(delta: number) {
  const to = index.value + delta
  if (to < 0 || to >= props.round.slides.length) return
  props.round.slides.splice(index.value, 1)
  props.round.slides.splice(to, 0, props.slide)
}

function remove() {
  const i = index.value
  props.round.slides.splice(i, 1)
  const next = props.round.slides[Math.min(i, props.round.slides.length - 1)]
  emit('select', next?.id ?? null)
}
</script>

<template>
  <div class="slide-inspector">
    <div class="preview-block">
      <StagePreview
        v-if="previewScreen"
        :screen="previewScreen"
        :round-id="round.id"
        :slide-index="index"
        :caption="false"
      />
      <div v-if="screens.length > 1" class="segmented" role="group" :aria-label="t('previewOn')">
        <button
          v-for="s in screens.filter((x) => targets(x.id))"
          :key="s.id"
          type="button"
          :class="{ on: previewScreen?.id === s.id }"
          @click="previewId = s.id"
        >
          {{ s.name }}
        </button>
      </div>
    </div>

    <div class="inspector-group">
      <span class="label">{{ t('layout') }}</span>
      <div class="segmented" role="group" :aria-label="t('layout')">
        <button
          v-for="l in LAYOUTS"
          :key="l.value"
          type="button"
          :class="{ on: slide.layout === l.value }"
          :aria-pressed="slide.layout === l.value"
          @click="slide.layout = l.value"
        >
          {{ l.label }}
        </button>
      </div>
    </div>

    <div v-if="slide.layout === 'question'" class="inspector-group">
      <span class="label">{{ t('shown') }}</span>
      <div class="segmented" role="group" :aria-label="t('shown')">
        <button
          type="button"
          :class="{ on: !slide.numberOnly }"
          :aria-pressed="!slide.numberOnly"
          @click="slide.numberOnly = undefined"
        >
          {{ t('showQuestion') }}
        </button>
        <button
          type="button"
          :class="{ on: slide.numberOnly }"
          :aria-pressed="!!slide.numberOnly"
          :title="t('readAloud')"
          @click="slide.numberOnly = true"
        >
          {{ t('showNumberOnly') }}
        </button>
      </div>
    </div>

    <div class="inspector-group">
      <div v-if="slide.layout !== 'number'" class="inspector-row">
        <span class="row-label">{{ t('image') }}</span>
        <ImageChip v-model="slide.imageAssetId" :label="t('image')" field />
      </div>
      <div v-if="slide.layout !== 'title'" class="inspector-row">
        <span class="row-label">{{ t('onAnswer') }}</span>
        <ImageChip v-model="slide.answerImageAssetId" :label="t('answerImage')" field />
      </div>
      <div class="inspector-row">
        <span class="row-label">{{ t('backdrop') }}</span>
        <BackdropPicker :slide="slide" />
      </div>
      <PluginSlot name="slideInspector" :round="round" :slide="slide" />
      <div v-if="screens.length > 1" class="inspector-row">
        <span class="row-label">{{ t('screens') }}</span>
        <div class="checks" role="group" :aria-label="t('onScreens')">
          <label v-for="s in screens" :key="s.id">
            <input type="checkbox" :checked="targets(s.id)" @change="toggleTarget(s.id)" />
            {{ s.name }}
          </label>
        </div>
      </div>
    </div>

    <footer class="foot">
      <button class="btn btn-ghost btn-sm" :disabled="index === 0" @click="move(-1)">
        <Icon name="left" :size="14" class="turn" /> {{ t('moveUp') }}
      </button>
      <button
        class="btn btn-ghost btn-sm"
        :disabled="index === round.slides.length - 1"
        @click="move(1)"
      >
        <Icon name="right" :size="14" class="turn" /> {{ t('moveDown') }}
      </button>
      <span class="grow" />
      <button class="btn btn-ghost btn-sm btn-danger" @click="remove">
        <Icon name="trash" :size="14" /> {{ t('remove') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.slide-inspector {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.preview-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.foot {
  display: flex;
  gap: 2px;
  margin: 0 -8px;
}

.turn {
  transform: rotate(90deg);
}
</style>
