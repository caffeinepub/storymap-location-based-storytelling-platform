import { Category } from '../backend';

export function getCategoryLabel(category: Category): string {
  const labels: Record<Category, string> = {
    [Category.love]: '❤️ Love',
    [Category.confession]: '🤫 Confession',
    [Category.funny]: '😂 Funny',
    [Category.random]: '🎲 Random',
    [Category.other]: '📝 Other',
  };
  return labels[category];
}

export function getCategoryColor(category: Category): string {
  const colors: Record<Category, string> = {
    [Category.love]: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    [Category.confession]: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    [Category.funny]: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    [Category.random]: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    [Category.other]: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
  };
  return colors[category];
}
