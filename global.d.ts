// Le template Expo importe des feuilles de style côté web ; sans ces
// déclarations, `tsc` échoue sur les imports .css.
declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.css';
