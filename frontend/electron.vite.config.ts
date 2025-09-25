// import { defineConfig } from 'vite'
// import electron from 'vite-plugin-electron'
// import { resolve } from 'path'

// export default defineConfig({
//   root: '.',                  // ок
//   publicDir: false,           // ничего не копировать из public
//   build: {
//     outDir: 'dist/electron',
//     emptyOutDir: false,       // не трогаем вывод рендера
//     // ВАЖНО: отключаем html-входы, иначе Vite ищет index.html
//     rollupOptions: { input: {} },
//   },
//   resolve: {
//     alias: {
//       '@main':   resolve(__dirname, 'src/main'),
//       '@ipc':    resolve(__dirname, 'src/main/ipc'),
//       '@shared': resolve(__dirname, 'src/shared'),
//     },
//   },
//   plugins: [
//     electron([
//       {
//         entry: 'src/main/index.ts',
//         vite: {
//           build: {
//             outDir: 'dist/electron/main',
//             rollupOptions: { output: { entryFileNames: 'index.js' } },
//             target: 'node18',
//           },
//         },
//         // автозапуск Electron после первой сборки main
//         onstart({ startup }) { startup() },
//       },
//       {
//         entry: 'src/main/preload.ts',
//         vite: {
//           build: {
//             outDir: 'dist/electron/preload',
//             rollupOptions: { output: { entryFileNames: 'preload.js' } },
//             target: 'node18',
//           },
//         },
//       },
//     ]),
//   ],
// })
