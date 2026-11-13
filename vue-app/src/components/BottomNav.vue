<template>
  <footer class="bottom-nav">
    <button :class="{ 'active-nav': activePage === '/' }" :aria-current="activePage === '/' ? 'page' : undefined" @click="$emit('navigate', '/')"><Home :size="23" />Home</button>
    <button :class="{ 'active-nav': activePage === '/games' }" :aria-current="activePage === '/games' ? 'page' : undefined" @click="$emit('navigate', '/games')"><Gamepad2 :size="23" />Games</button>
    <button :class="{ 'active-nav': activePage === '/promotions' }" :aria-current="activePage === '/promotions' ? 'page' : undefined" @click="$emit('navigate', '/promotions')"><Gift :size="23" />Promotions</button>
    <button :class="{ 'active-nav': activePage === '/rewards' }" :aria-current="activePage === '/rewards' ? 'page' : undefined" @click="$emit('navigate', '/rewards')"><Award :size="23" />Rewards</button>
    <button :class="{ 'active-nav': activePage === '/account' }" :aria-current="activePage === '/account' ? 'page' : undefined" @click="$emit('navigate', '/account')"><UserRound :size="23" />Account</button>
  </footer>
</template>

<script setup lang="ts">
import { Award, Gamepad2, Gift, Home, UserRound } from "lucide-vue-next";

defineProps<{ activePage: string }>();
defineEmits<{ navigate: [path: string] }>();
</script>
