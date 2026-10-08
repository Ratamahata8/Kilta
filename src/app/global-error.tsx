'use client'
export default function GlobalError({ reset }: { reset: () => void }) { return <html lang="ru"><body><main style={{ margin: 40, fontFamily: 'sans-serif' }}><h1>Сайт временно недоступен</h1><p>Не удалось подключиться к сервису. Пожалуйста, попробуйте позже.</p><button onClick={reset}>Повторить</button></main></body></html> }
