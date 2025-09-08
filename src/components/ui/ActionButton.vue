<template>
  <button
    @click="$emit('click')"
    :disabled="disabled"
    :class="[
      'inline-flex items-center px-4 py-2 text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors',
      variant === 'primary' && 'text-white bg-red-600 hover:bg-red-700 focus:ring-red-500',
      variant === 'secondary' && 'text-white bg-gray-600 hover:bg-gray-700 focus:ring-gray-500',
      variant === 'outline' && 'text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 focus:ring-blue-500',
      variant === 'blue' && 'text-white bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      disabled && 'opacity-50 cursor-not-allowed'
    ]"
  >
    <slot name="icon"></slot>
    <slot></slot>
  </button>
</template>

<script setup>
defineEmits(['click']);

defineProps({
  variant: {
    type: String,
    default: 'primary',
    validator: (value) => ['primary', 'secondary', 'outline', 'blue'].includes(value)
  },
  disabled: {
    type: Boolean,
    default: false
  }
});
</script>