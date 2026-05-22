export default {
  test: {
    environment: 'node',
    include: ['**/*.test.js'],
    exclude: ['node_modules', 'promo-video', 'archive'],
  }
};
