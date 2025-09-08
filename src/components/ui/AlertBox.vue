<template>
  <div 
    :class="[
      'border rounded-md p-4 mb-6',
      type === 'error' && 'bg-red-50 border-red-200',
      type === 'warning' && 'bg-yellow-50 border-yellow-200',
      type === 'info' && 'bg-blue-50 border-blue-200',
      type === 'success' && 'bg-green-50 border-green-200'
    ]"
  >
    <div class="flex">
      <svg
        :class="[
          'w-5 h-5 mt-0.5 mr-3',
          type === 'error' && 'text-red-400',
          type === 'warning' && 'text-yellow-400',
          type === 'info' && 'text-blue-400',
          type === 'success' && 'text-green-400'
        ]"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          v-if="type === 'error'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
        <path
          v-else-if="type === 'warning'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
        <path
          v-else-if="type === 'info'"
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
        />
        <path
          v-else
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M5 13l4 4L19 7"
        />
      </svg>
      <div>
        <h3 
          :class="[
            'text-sm font-medium',
            type === 'error' && 'text-red-800',
            type === 'warning' && 'text-yellow-800',
            type === 'info' && 'text-blue-800',
            type === 'success' && 'text-green-800'
          ]"
        >
          {{ title }}
        </h3>
        <p 
          :class="[
            'text-sm mt-1',
            type === 'error' && 'text-red-700',
            type === 'warning' && 'text-yellow-700',
            type === 'info' && 'text-blue-700',
            type === 'success' && 'text-green-700'
          ]"
        >
          {{ message }}
        </p>
        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  type: {
    type: String,
    required: true,
    validator: (value) => ['error', 'warning', 'info', 'success'].includes(value)
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  }
});
</script>