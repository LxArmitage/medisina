/**
 * La sina sabe de jardinería en general, no sólo de tu expediente.
 *
 * Las preguntas de aquí están escritas distinto de las del catálogo de
 * `saber.ts`, como las escribiría alguien con prisa. Si la búsqueda sólo
 * reconociera las frases exactas, sería el mismo chatbot de antes.
 */

import { TEMAS_DE_SABER, buscarSaber } from '../src/dominio/saber';

const CASOS: Array<[string, string]> = [
  ['oye qué fertilizante le echo a mis plantas', 'abono'],
  ['cada cuándo hay que abonarlas', 'abono'],
  ['ya le salen las raíces por el agujero de abajo', 'trasplante'],
  ['la maceta que compré no tiene hoyo abajo, pasa algo?', 'drenaje'],
  ['está bien regarlas con agua de la llave o tiene mucho cloro', 'agua_llave'],
  ['me voy de viaje 10 días quién me las cuida', 'vacaciones'],
  ['se están poniendo amarillas las hojas de abajo', 'hojas_amarillas'],
  ['tiene las puntitas de las hojas cafés y secas', 'puntas_secas'],
  ['le salieron unas bolitas blancas como algodón en el tallo', 'cochinilla'],
  ['tiene un montón de piojitos verdes en los brotes nuevos', 'pulgon'],
  ['veo unas telarañas muy finitas entre las hojas', 'arana_roja'],
  ['cuando la muevo salen volando unas mosquitas blancas', 'mosca_blanca'],
  ['de la tierra salen moscos negros chiquitos', 'mosquitos_tierra'],
  ['hay hormigas subiendo por la maceta', 'hormigas'],
  ['algo se come las hojas en la noche y deja baba', 'caracoles'],
  ['la tierra de la maceta huele a podrido', 'raiz_podrida'],
  ['la saqué al patio al sol y le salieron manchas blancas', 'quemadura_sol'],
  ['se está estirando mucho y se ve larguirucha', 'larguirucha'],
  ['por qué mi planta nunca da flores', 'no_florece'],
  ['cómo le subo la humedad si el aire está muy seco', 'humedad'],
  ['va a hacer mucho calor esta semana qué hago con mis plantas', 'calor'],
  ['dicen que va a helar esta noche', 'frio'],
  ['qué tierra le pongo a mis cactus', 'que_tierra'],
  ['se le están cayendo muchas hojas al ficus', 'hojas_caen'],
  ['la cambié de maceta y se puso triste', 'marchita_trasplante'],
  ['es mejor maceta de barro o de plástico', 'barro_plastico'],
  ['mi cactus se ve todo arrugado', 'suculenta_arrugada'],
  ['el agua del frasco del esqueje está verde', 'esqueje_agua'],
  ['las hojas tienen algo pegajoso', 'pegajosa'],
  ['sirve ponerle café molido a la tierra', 'cafe_huevo'],
  ['cómo preparo jabón potásico', 'jabon_neem'],
  ['la albahaca ya echó flor qué hago', 'hierbas_cocina'],
  ['cómo sé si ya necesita agua', 'necesita_agua'],
  ['cómo le haces para saber cuándo regar', 'como_calcula'],
];

describe('encuentra la respuesta aunque se pregunte distinto', () => {
  it.each(CASOS)('«%s» → %s', (pregunta, esperado) => {
    expect(buscarSaber(pregunta)?.id).toBe(esperado);
  });
});

describe('no inventa', () => {
  it.each(['asdkjfh qwerty', 'quién ganó el partido', 'cuánto es dos más dos', 'hola'])('«%s» no tiene respuesta', (p) => {
    expect(buscarSaber(p)).toBeNull();
  });
});

describe('habla de tus plantas cuando importa', () => {
  const mias = [
    { apodo: 'Sinita', familia: 'cactacea_suculenta', perfilHidrico: 'xerico', interior: false },
    { apodo: 'Helecho Rulo', familia: 'helecho', perfilHidrico: 'alto', interior: false },
  ];

  it('en el abono, nombra a las suculentas', () => {
    expect(buscarSaber('qué abono le pongo', mias)?.respuesta).toMatch(/Sinita/);
  });

  it('en las vacaciones, nombra a las que más agua piden', () => {
    expect(buscarSaber('me voy de vacaciones', mias)?.respuesta).toMatch(/Helecho Rulo/);
  });

  it('sabe de varios temas', () => {
    expect(TEMAS_DE_SABER).toBeGreaterThanOrEqual(40);
  });
});
