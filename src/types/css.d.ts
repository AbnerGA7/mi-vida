// Hojas de estilo que solo usa la versión web: le digo a TypeScript qué devuelven al importarlas.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
