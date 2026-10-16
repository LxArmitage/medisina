/**
 * Lo que sabe la sina de jardinería en general.
 *
 * El modelo de intenciones reconoce diecisiete temas y para cada uno hay datos
 * de TU planta. Pero la gente pregunta mucho más: qué abono le pongo, si sirve
 * el agua de la llave, qué hago si me voy de vacaciones, qué son unas bolitas
 * de algodón en las hojas. Antes todo eso terminaba en "de eso no sé", y eso es
 * lo que hacía que el asistente se sintiera como un chatbot de respuestas
 * fijas.
 *
 * Aquí hay respuestas prácticas y ciertas para esas preguntas, pensadas para
 * macetas y patios de México. Se buscan por parecido (BM25, el mismo método de
 * los buscadores: pesa más la palabra rara que la común) y, cuando la
 * respuesta depende del tipo de planta, se personaliza con las tuyas: "tus
 * suculentas —Sinita y la Sábila— casi no piden abono".
 *
 * Sin internet y sin inventar: si nada se parece lo suficiente, se dice.
 */

export interface PlantaParaSaber {
  apodo: string;
  familia: string;
  perfilHidrico: string;
  interior: boolean;
}

interface Entrada {
  id: string;
  /**
   * El tema del modelo de intenciones con el que se traslapa, si hay uno. Ahí
   * manda el expediente de tus plantas y esto sólo se agrega como "cómo".
   */
  tema?: string;
  /** Formas de preguntarlo. Son lo que se busca. */
  preguntas: string[];
  /** Palabras que casi seguro aparecen si se pregunta esto. */
  claves: string[];
  respuesta: (plantas: PlantaParaSaber[]) => string;
}

const suculentas = (p: PlantaParaSaber[]) => p.filter((x) => x.familia === 'cactacea_suculenta' || x.perfilHidrico === 'xerico');
const deAgua = (p: PlantaParaSaber[]) => p.filter((x) => x.perfilHidrico === 'alto' || x.familia === 'helecho');
const adentro = (p: PlantaParaSaber[]) => p.filter((x) => x.interior);

function lista(nombres: string[]): string {
  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0];
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** "Tus suculentas (Sinita y la Sábila)". */
function tus(que: string, plantas: PlantaParaSaber[]): string {
  return plantas.length === 0 ? '' : `${que} (${lista(plantas.slice(0, 3).map((p) => p.apodo))})`;
}

const ENTRADAS: Entrada[] = [
  {
    id: 'abono',
    preguntas: ['qué abono le pongo', 'cada cuánto la fertilizo', 'qué fertilizante uso', 'cómo la abono', 'le pongo vitaminas'],
    claves: ['abono', 'abonar', 'fertilizante', 'fertilizar', 'nutrientes', 'vitaminas', 'composta'],
    respuesta: (p) => {
      const s = suculentas(p);
      return `Abona sólo cuando está creciendo (de marzo a septiembre) y con la tierra húmeda, nunca seca: el abono sobre raíz seca la quema. Un fertilizante líquido balanceado (tipo 20-20-20) a la mitad de lo que dice la etiqueta, cada 3 o 4 semanas, es suficiente. ${
        s.length > 0 ? `${tus('Tus suculentas', s)} piden todavía menos: una o dos veces en todo el verano. ` : ''
      }En otoño e invierno no abones: la planta casi no crece y el abono se acumula como sal.`;
    },
  },
  {
    id: 'trasplante',
    tema: 'sustrato',
    preguntas: ['cuándo la cambio de maceta', 'cómo la trasplanto', 'le salen raíces por abajo', 'necesita maceta más grande', 'cuándo trasplantar'],
    claves: ['trasplante', 'trasplantar', 'cambiar', 'maceta', 'grande', 'raices', 'raíces', 'enraizada'],
    respuesta: () =>
      'Se cambia de maceta cuando las raíces salen por el agujero de abajo o dan vueltas pegadas a la pared, o cuando el agua ya no se absorbe y escurre de inmediato. El mejor momento es la primavera. Usa una maceta sólo 2 o 3 cm más ancha: una mucho más grande guarda agua de más y pudre la raíz. Después del trasplante riégala una vez y déjala a media sombra unos días: es normal que se vea caída una semana.',
  },
  {
    id: 'drenaje',
    tema: 'sustrato',
    preguntas: ['mi maceta no tiene agujero', 'la maceta no tiene drenaje', 'le pongo piedras abajo', 'maceta sin hoyo'],
    claves: ['agujero', 'hoyo', 'drenaje', 'piedras', 'grava', 'escurre', 'plato'],
    respuesta: () =>
      'Una maceta sin agujero es la causa número uno de raíz podrida: el agua de más no tiene por dónde salir. Lo mejor es hacerle un agujero (con taladro y broca para cerámica, despacio y con agua) o usarla de cubremaceta con una maceta de plástico adentro. Las piedras en el fondo NO sirven de drenaje: suben el nivel del agua estancada. Y vacía el plato de abajo media hora después de regar.',
  },
  {
    id: 'agua_llave',
    tema: 'riego',
    preguntas: ['puedo usar agua de la llave', 'el agua del grifo sirve', 'agua con cloro', 'agua de lluvia es mejor', 'qué agua uso para regar'],
    claves: ['llave', 'grifo', 'cloro', 'lluvia', 'garrafon', 'garrafón', 'purificada', 'dura', 'sarro'],
    respuesta: () =>
      'Sí, el agua de la llave sirve para casi todas. Si la dejas reposar una noche en un recipiente abierto se le va buena parte del cloro, y a temperatura ambiente no le da un golpe de frío a la raíz. El agua de lluvia es la mejor si la puedes juntar. Si en tu zona el agua es muy dura (deja sarro blanco en la tierra o la maceta), las más sensibles lo notan en las puntas: ahí conviene mezclarla con agua de lluvia o purificada.',
  },
  {
    id: 'como_regar',
    tema: 'riego',
    preguntas: ['cómo la riego bien', 'cuánta agua le echo', 'riego por abajo', 'riego por inmersión', 'la riego poquito diario'],
    claves: ['regar', 'riego', 'inmersion', 'inmersión', 'poquito', 'diario', 'chorrito', 'escurra'],
    respuesta: () =>
      'Riega a fondo y menos seguido: echa agua despacio hasta que escurra por abajo, así se moja toda la raíz, y luego espera a que la tierra se seque lo que esa especie necesita. Un chorrito diario es lo peor: moja sólo la superficie y la raíz se queda arriba, débil. Si la tierra está tan seca que el agua resbala, sumerge la maceta en una cubeta 10 minutos. Yo te digo cuándo toca cada una mirando el clima y lo que registras.',
  },
  {
    id: 'hora_riego',
    tema: 'riego',
    preguntas: ['a qué hora riego', 'riego en la mañana o en la noche', 'puedo regar con sol', 'mejor hora para regar'],
    claves: ['hora', 'mañana', 'noche', 'tarde', 'mediodia', 'mediodía', 'temprano'],
    respuesta: () =>
      'La mejor hora es temprano en la mañana: la planta tiene agua para el calor del día y las hojas se secan rápido, lo que evita hongos. En la tarde-noche también sirve para las de adentro, pero afuera deja las hojas mojadas toda la noche. Regar con sol fuerte no quema las hojas (es un mito), pero se evapora mucha agua antes de llegar a la raíz.',
  },
  {
    id: 'vacaciones',
    preguntas: ['me voy de vacaciones', 'me voy de viaje una semana', 'quién las riega si no estoy', 'cómo las dejo si salgo'],
    claves: ['vacaciones', 'viaje', 'salgo', 'fuera', 'semana', 'ausente', 'dejar'],
    respuesta: (p) => {
      const agua = deAgua(p);
      return `Para una semana: riégalas bien el día antes de irte, júntalas lejos del sol directo (a la sombra pierden la mitad de agua) y ponlas sobre un plato con piedras y agua. ${
        agua.length > 0 ? `${tus('Las que más agua piden', agua)} agradecen una botella con agujerito enterrada boca abajo, o un cordón de algodón de un vaso de agua a la tierra. ` : ''
      }Las suculentas y cactus aguantan dos o tres semanas sin nada. Si son más de dos semanas, pídele a alguien que las riegue una vez.`;
    },
  },
  {
    id: 'hojas_amarillas',
    tema: 'sintoma',
    preguntas: ['por qué se ponen amarillas las hojas', 'tiene hojas amarillas', 'se le amarillean las hojas de abajo'],
    claves: ['amarillas', 'amarillo', 'amarillean', 'amarillenta', 'palidas', 'pálidas'],
    respuesta: () =>
      'Las hojas amarillas casi siempre son agua, pero en dos sentidos opuestos: si la tierra está mojada días y días y las amarillas son las de abajo y se ven blandas, es exceso (la raíz se ahoga). Si la tierra está seca y las hojas se ven lacias y crujientes, es falta. Si es sólo una hoja vieja de abajo de vez en cuando, es normal: la planta la recicla. Dime cuál es y cómo está su tierra y lo cruzo con lo que tengo anotado.',
  },
  {
    id: 'puntas_secas',
    tema: 'sintoma',
    preguntas: ['tiene las puntas secas', 'las puntas se ponen cafés', 'orillas quemadas de las hojas', 'se secan las puntitas'],
    claves: ['puntas', 'puntitas', 'orillas', 'bordes', 'quemadas', 'cafes', 'cafés', 'secas'],
    respuesta: () =>
      'Las puntas cafés suelen ser de aire seco o de sales: pasa mucho con aire acondicionado, calefacción o agua muy dura, y con abono de más. Si la tierra está bien de agua, sube la humedad (júntala con otras plantas o ponle un plato con piedras y agua) y una vez al mes riega a chorro para lavar las sales. Lo café ya no se recupera: puedes recortarlo en diagonal siguiendo la forma de la hoja.',
  },
  {
    id: 'cochinilla',
    tema: 'plaga',
    preguntas: ['tiene como algodón blanco', 'bichitos blancos en las hojas', 'bolitas blancas pegadas', 'cochinilla algodonosa'],
    claves: ['algodon', 'algodón', 'blancos', 'bolitas', 'cochinilla', 'harinosa', 'pelusa'],
    respuesta: () =>
      'Eso es cochinilla algodonosa: bichitos que chupan la savia y se esconden en las axilas de las hojas y en el envés. Aísla la planta de las demás. Quítalas con un cotonete mojado en alcohol (del de botiquín), una por una, y luego rocía con agua y jabón potásico (o jabón neutro, una cucharadita por litro) cada 5 días, tres veces. Revisa también la raíz: a veces también viven en la tierra.',
  },
  {
    id: 'pulgon',
    tema: 'plaga',
    preguntas: ['tiene piojitos verdes', 'bichitos verdes en los brotes', 'pulgón en las hojas nuevas', 'bichos negros en la punta'],
    claves: ['pulgon', 'pulgón', 'piojitos', 'verdes', 'brotes', 'negros', 'amontonados'],
    respuesta: () =>
      'Suena a pulgón: se amontonan en los brotes tiernos y dejan las hojas nuevas enroscadas y pegajosas. Un chorro de agua fuerte los tumba; si regresan, jabón potásico cada 5 días. Las hormigas los "cuidan", así que si ves hormigas subiendo, ahí están. Evita el abono de más, que hace brotes blanditos que les encantan.',
  },
  {
    id: 'arana_roja',
    tema: 'plaga',
    preguntas: ['tiene telarañas finas', 'puntitos amarillos en las hojas', 'arañita roja', 'hojas punteadas y polvosas'],
    claves: ['telaraña', 'telarañas', 'araña', 'arañita', 'punteadas', 'puntitos', 'acaro', 'ácaro'],
    respuesta: () =>
      'Telarañas finísimas y hojas punteadas de amarillo son araña roja, un ácaro que ama el calor seco. Lávala bien por debajo de las hojas con la regadera o la regadera del baño, sube la humedad alrededor y rocía jabón potásico o aceite de neem cada 5 días. Aíslala: brinca de planta en planta.',
  },
  {
    id: 'mosca_blanca',
    tema: 'plaga',
    preguntas: ['salen mosquitas blancas al mover la planta', 'moscas blancas chiquitas', 'mosca blanca en las hojas'],
    claves: ['mosca', 'moscas', 'mosquitas', 'blancas', 'vuelan', 'volando', 'muevo', 'nube', 'nubecita'],
    respuesta: () =>
      'Si al mover la planta sale una nubecita blanca, es mosca blanca. Pon trampas amarillas pegajosas junto a la planta (atrapan a las adultas) y rocía el envés de las hojas con jabón potásico o neem cada 5 días, al atardecer. Revisa las plantas vecinas.',
  },
  {
    id: 'mosquitos_tierra',
    tema: 'plaga',
    preguntas: ['salen mosquitos de la tierra', 'moscos negros chiquitos en la maceta', 'mosquitas negras volando en la tierra'],
    claves: ['mosquitos', 'moscos', 'negros', 'negras', 'tierra', 'sustrato', 'volando'],
    respuesta: () =>
      'Los mosquitos negros que salen de la tierra (sciáridos) son señal de tierra que pasa demasiado tiempo mojada: sus larvas comen materia orgánica y raicitas. Deja secar más la capa de arriba entre riegos, pon una trampa amarilla pegajosa, y si son muchos, riega una vez con agua con un chorrito de agua oxigenada (1 parte por 4 de agua).',
  },
  {
    id: 'hormigas',
    tema: 'plaga',
    preguntas: ['hay hormigas en la maceta', 'hormigas en la planta', 'hormiguero en la tierra'],
    claves: ['hormigas', 'hormiga', 'hormiguero'],
    respuesta: () =>
      'Las hormigas no se comen la planta, pero casi siempre "cuidan" pulgón o cochinilla para comerse lo dulce que sueltan: revisa brotes y envés. Si hicieron nido en la maceta, sumérgela en agua 15 minutos y se van. Canela o un círculo de talco alrededor de la maceta las desanima.',
  },
  {
    id: 'caracoles',
    tema: 'plaga',
    preguntas: ['se comen las hojas por la noche', 'hay caracoles', 'babosas en el patio', 'hojas con hoyos y baba'],
    claves: ['caracoles', 'caracol', 'babosas', 'babosa', 'baba', 'hoyos', 'mordidas'],
    respuesta: () =>
      'Hoyos irregulares y rastro brillante son caracoles o babosas, que salen de noche y con humedad. Búscalos con lámpara después de regar o de llover y quítalos a mano. Una barrera de cáscara de huevo molida o ceniza alrededor les estorba, y una trampa de cerveza en un vasito enterrado los atrae lejos de la planta.',
  },
  {
    id: 'manchas_hongo',
    tema: 'sintoma',
    preguntas: ['tiene manchas negras en las hojas', 'manchas cafés con orilla amarilla', 'polvo blanco en las hojas', 'hongo en las hojas'],
    claves: ['manchas', 'negras', 'hongo', 'hongos', 'oidio', 'oídio', 'polvo', 'ceniza'],
    respuesta: () =>
      'Manchas negras o cafés con halo amarillo, o un polvito blanco como ceniza, suelen ser hongos. Aparecen con humedad alta, hojas que se quedan mojadas y poco aire. Corta las hojas manchadas (con tijera limpia y tírala a la basura, no a la composta), riega directo a la tierra y no a las hojas, y dale más ventilación. Si sigue, un fungicida a base de cobre o azufre.',
  },
  {
    id: 'moho_tierra',
    tema: 'sintoma',
    preguntas: ['le salió moho blanco a la tierra', 'la tierra tiene pelusa blanca', 'hongo en la tierra de la maceta'],
    claves: ['moho', 'pelusa', 'blanco', 'tierra', 'sustrato', 'hongo'],
    respuesta: () =>
      'La pelusita blanca sobre la tierra es moho, casi siempre inofensivo para la planta, pero avisa que la tierra está húmeda demasiado tiempo y con poca ventilación. Raspa esa capa, deja secar más entre riegos y ponla donde corra el aire. Espolvorear canela encima ayuda a que no regrese.',
  },
  {
    id: 'raiz_podrida',
    tema: 'sintoma',
    preguntas: ['la tierra huele feo', 'la base del tallo está blanda', 'se pudrió la raíz', 'huele a podrido la maceta'],
    claves: ['huele', 'olor', 'podrido', 'podrida', 'pudrio', 'pudrió', 'blanda', 'aguada'],
    respuesta: () =>
      'Olor a podrido y base blanda son pudrición de raíz por exceso de agua. Sácala de la maceta: las raíces sanas son firmes y claras; las podridas, cafés, aguadas y se deshacen. Corta todo lo podrido con tijera limpia, deja secar las raíces unas horas y replántala en tierra nueva y seca, en una maceta con buen agujero. No la riegues hasta dentro de unos días. Si el tallo ya está blando, saca esquejes de lo sano: es la forma segura de no perderla.',
  },
  {
    id: 'luz_general',
    tema: 'luz',
    preguntas: ['cuánta luz necesita', 'dónde la pongo', 'la pongo junto a la ventana', 'necesita sol directo'],
    claves: ['luz', 'ventana', 'sol', 'sombra', 'donde', 'dónde', 'lugar', 'iluminacion'],
    respuesta: () =>
      '"Luz brillante indirecta" es junto a una ventana pero sin que le pegue el sol directo, o a un metro de una ventana soleada. Un truco: a mediodía pon la mano sobre la planta; si la sombra de tu mano se ve bien marcada, es luz fuerte; si se ve difusa, es media; si casi no hay sombra, es poca. Cada una de tus plantas tiene su banda de luz en su ficha, y el riego que te sugiero ya la toma en cuenta.',
  },
  {
    id: 'quemadura_sol',
    tema: 'luz',
    preguntas: ['la saqué al sol y se quemó', 'manchas blancas después de sacarla al sol', 'puedo sacarla al sol'],
    claves: ['quemo', 'quemó', 'quemada', 'sacarla', 'saque', 'saqué', 'blancas', 'decolorada'],
    respuesta: () =>
      'Una planta que vivía adentro se quema si la pasas al sol de golpe, aunque sea de sol: salen manchas blancas o cafés secas. Hay que aclimatarla en dos semanas: primero sol de la mañana una hora, y cada par de días un poco más. Las manchas quemadas no se quitan, pero la hoja nueva ya sale adaptada.',
  },
  {
    id: 'larguirucha',
    tema: 'luz',
    preguntas: ['está creciendo larga y flaca', 'se estira mucho', 'los tallos se alargan y se inclinan', 'se ve larguirucha'],
    claves: ['larga', 'flaca', 'estira', 'estirada', 'larguirucha', 'inclina', 'ladea'],
    respuesta: () =>
      'Tallos largos, flacos y con mucho espacio entre hojas es la planta buscando luz (etiolación). Acércala a más luz poco a poco y dale vuelta a la maceta cada semana para que no crezca chueca. Lo estirado ya no se corrige: si quieres que se vea tupida, pódala por arriba de un nudo y rebrotará más compacta.',
  },
  {
    id: 'no_florece',
    tema: 'fenologia',
    preguntas: ['por qué no florece', 'no da flores', 'nunca ha florecido', 'cómo hago que florezca'],
    claves: ['florece', 'flores', 'flor', 'florezca', 'florecido', 'botones'],
    respuesta: () =>
      'Casi siempre que no florece es por falta de luz: la mayoría de las de flor necesitan varias horas de sol. La segunda causa es abono con mucho nitrógeno (hace hojas, no flores): usa uno "para floración" en su temporada. Y la tercera, podarla en mal momento y cortarle los botones. En la ficha de cada una te digo cuándo es su temporada de flor.',
  },
  {
    id: 'humedad',
    tema: 'tolerancia',
    preguntas: ['cómo le subo la humedad', 'la rocío con agua', 'el aire es muy seco', 'necesita humedad'],
    claves: ['humedad', 'rocio', 'rocío', 'rociar', 'atomizador', 'seco', 'humidificador'],
    respuesta: (p) => {
      const a = deAgua(p);
      return `Rociar las hojas sube la humedad sólo unos minutos. Lo que sí funciona: juntar varias plantas (se dan humedad entre ellas), ponerlas sobre un plato con piedras y agua sin que la maceta toque el agua, o un humidificador. Aléjalas del aire acondicionado y de ventiladores. ${
        a.length > 0 ? `${tus('Las que más lo agradecen de las tuyas', a)}.` : ''
      }`.trim();
    },
  },
  {
    id: 'calor',
    tema: 'tolerancia',
    preguntas: ['hace mucho calor qué hago', 'ola de calor', 'se marchita en la tarde por el calor', 'cómo las protejo del calor'],
    claves: ['calor', 'caliente', 'ola', 'temperatura', 'marchita', 'tarde', 'bochorno'],
    respuesta: () =>
      'Con calor fuerte: riega temprano en la mañana (no al mediodía), mueve a media sombra las que no son de sol pleno, y agrupa las macetas para que se den sombra entre ellas. Una malla sombra o una sábana clara en las horas fuertes salva a muchas. Si se ve marchita en la tarde pero amanece bien, es normal: se está protegiendo; si amanece marchita, le falta agua de verdad. En "El clima de estos días" te aviso cuál conviene mover.',
  },
  {
    id: 'frio',
    tema: 'tolerancia',
    preguntas: ['va a helar', 'cómo las protejo del frío', 'hace mucho frío en la noche', 'se congela'],
    claves: ['frio', 'frío', 'helada', 'helar', 'congela', 'invierno', 'noche'],
    respuesta: () =>
      'Si va a helar, mete a la casa las tropicales o tápalas en la noche con una sábana o cartón (sin plástico pegado a las hojas) y quítalo en la mañana. Riega la tarde anterior: la tierra húmeda guarda más calor que la seca. En invierno riega mucho menos: la planta casi no crece. Te aviso en "El clima de estos días" cuando una noche vaya a bajar de lo que aguanta cada una.',
  },
  {
    id: 'poda_general',
    tema: 'poda',
    preguntas: ['cómo se poda', 'dónde corto', 'con qué la podo', 'la puedo podar'],
    claves: ['podar', 'poda', 'corto', 'cortar', 'tijera', 'recortar', 'nudo'],
    respuesta: () =>
      'Poda con tijera limpia y afilada (pásale alcohol antes), justo arriba de un nudo o de una yema que mire hacia afuera: de ahí sale la rama nueva. Quita primero lo seco, lo enfermo y lo que crece hacia adentro. No le quites más de un tercio de una vez. La mejor época para casi todas es al final del invierno, antes de que arranque a crecer; en la ficha de cada planta te digo la suya.',
  },
  {
    id: 'esquejes_general',
    tema: 'propagacion',
    preguntas: ['cómo saco un esqueje', 'cómo la reproduzco', 'hijitos de la planta', 'enraizar en agua'],
    claves: ['esqueje', 'esquejes', 'reproducir', 'reproduzco', 'hijitos', 'enraizar', 'multiplicar'],
    respuesta: () =>
      'Para casi todas: corta un tramo de 10 a 15 cm justo abajo de un nudo, quítale las hojas de abajo y ponlo en agua o en tierra húmeda con perlita, con luz pero sin sol directo. En agua cambia el agua cada 3 o 4 días y pásalo a tierra cuando las raíces midan unos 3 cm. Las suculentas son distinto: deja secar el corte 2 o 3 días antes de plantarlo, o se pudre. En la ficha de cada una te digo su método y su temporada.',
  },
  {
    id: 'semillas',
    preguntas: ['cómo siembro semillas', 'cómo germino una semilla', 'cuándo siembro', 'las semillas no germinan'],
    claves: ['semilla', 'semillas', 'sembrar', 'siembro', 'germinar', 'germino', 'almacigo', 'almácigo'],
    respuesta: () =>
      'Siembra a una profundidad de dos veces el tamaño de la semilla, en tierra suelta y húmeda (no encharcada), y cubre con plástico o una tapa transparente para guardar humedad. Casi todas germinan entre 20 y 28 °C. Si en dos o tres semanas no salen, suelen ser semillas viejas o tierra muy fría. En "Semillas" te ayudo a identificar la tuya y te digo cómo sembrarla.',
  },
  {
    id: 'que_tierra',
    tema: 'sustrato',
    preguntas: ['qué tierra uso', 'qué sustrato le pongo', 'tierra para suculentas', 'mezcla de tierra'],
    claves: ['tierra', 'sustrato', 'mezcla', 'perlita', 'turba', 'arena', 'tezontle', 'pongo', 'tipo'],
    respuesta: (p) => {
      const s = suculentas(p);
      return `Para la mayoría: tierra para macetas con un tercio de perlita o tezontle fino, para que drene y la raíz respire. La tierra del jardín sola se compacta en la maceta. ${
        s.length > 0 ? `${tus('Tus suculentas', s)} van en mezcla para cactus: la mitad tierra y la mitad tezontle o arena gruesa. ` : ''
      }Cámbiala cada dos o tres años: con el tiempo pierde estructura y nutrientes.`;
    },
  },
  {
    id: 'hojas_caen',
    tema: 'sintoma',
    preguntas: ['se le caen las hojas', 'tira muchas hojas', 'se le están cayendo las hojas verdes'],
    claves: ['caen', 'caer', 'cayendo', 'tira', 'deshoja', 'pierde'],
    respuesta: () =>
      'Que tire hojas de golpe suele ser estrés por cambio: la moviste de lugar, cambió la luz, le dio un aire frío o caliente, o cambió mucho el riego. El ficus es famoso por eso. Déjala quieta en un buen lugar, riega sólo cuando toque y en dos o tres semanas se estabiliza y saca hoja nueva. Si además la tierra huele feo, es la raíz.',
  },
  {
    id: 'marchita_trasplante',
    tema: 'sintoma',
    preguntas: ['la trasplanté y se marchitó', 'después de cambiarla de maceta se ve triste', 'se cayó después de trasplantar'],
    claves: ['trasplante', 'trasplante', 'trasplanté', 'cambiarla', 'triste', 'marchito', 'después'],
    respuesta: () =>
      'Es normal que se vea caída una o dos semanas después del trasplante: perdió raicitas finas y tiene que rehacerlas. Déjala en media sombra, sin abono (quema la raíz lastimada), y riega sólo cuando la tierra se empiece a secar. Si pasadas tres semanas sigue igual, revisa que la maceta drene.',
  },
  {
    id: 'limpiar_hojas',
    preguntas: ['cómo le limpio las hojas', 'tiene polvo en las hojas', 'le paso un trapo', 'abrillantador de hojas'],
    claves: ['limpiar', 'limpio', 'polvo', 'trapo', 'brillo', 'abrillantador'],
    respuesta: () =>
      'Pásale un trapo húmedo suave por las dos caras de la hoja, o métela a la regadera con agua tibia de vez en cuando: el polvo le tapa la luz. No uses abrillantadores ni aceite: tapan los poros. A las de hoja peluda (como la violeta) no las mojes: usa una brochita seca.',
  },
  {
    id: 'barro_plastico',
    tema: 'sustrato',
    preguntas: ['maceta de barro o de plástico', 'qué maceta es mejor', 'macetas de barro'],
    claves: ['barro', 'plastico', 'plástico', 'ceramica', 'cerámica', 'material', 'maceta'],
    respuesta: () =>
      'El barro respira: la tierra se seca más rápido, ideal para suculentas, cactus y para quien tiende a regar de más. El plástico guarda la humedad más tiempo: bueno para helechos y plantas de agua, y para lugares muy calurosos. En las dos, lo que no puede faltar es el agujero de abajo. En la ficha de cada planta puedes anotar el material y ajusto el riego.',
  },
  {
    id: 'suculenta_arrugada',
    tema: 'sintoma',
    preguntas: ['el cactus está arrugado', 'la suculenta se ve arrugada', 'las hojas de la suculenta están blandas', 'la sábila está delgada'],
    claves: ['arrugado', 'arrugada', 'suculenta', 'cactus', 'blandas', 'delgada', 'desinflada'],
    respuesta: (p) => {
      const s = suculentas(p);
      return `En suculentas y cactus: arrugada y desinflada con la tierra seca es sed, riégala a fondo y en unos días se infla. Blanda, traslúcida o negra en la base con la tierra húmeda es exceso de agua, y eso es grave: no riegues y revisa la raíz. ${
        s.length > 0 ? `De las tuyas, ${lista(s.slice(0, 3).map((x) => x.apodo))} ${s.length === 1 ? 'es de este tipo' : 'son de este tipo'}: te aviso cuando toque.` : ''
      }`.trim();
    },
  },
  {
    id: 'esqueje_agua',
    tema: 'propagacion',
    preguntas: ['cuándo lo paso de agua a tierra', 'el esqueje en agua cada cuánto cambio el agua', 'el agua del frasco está verde'],
    claves: ['frasco', 'agua', 'tierra', 'pasar', 'esqueje', 'verde', 'turbia'],
    respuesta: () =>
      'Cámbiale el agua cada 3 o 4 días (o cuando se vea turbia) y lava el frasco si se pone verde: son algas, no dañan, pero quitan oxígeno. Pásalo a tierra cuando las raíces midan 3 o 5 cm: más largas se acostumbran al agua y les cuesta. Los primeros días en tierra mantenla húmeda, que está aprendiendo.',
  },
  {
    id: 'pegajosa',
    tema: 'plaga',
    preguntas: ['las hojas están pegajosas', 'tiene algo pegajoso', 'hollín negro en las hojas'],
    claves: ['pegajosa', 'pegajosas', 'pegajoso', 'melaza', 'hollin', 'hollín', 'miel'],
    respuesta: () =>
      'Lo pegajoso es melaza: la sueltan pulgones, cochinillas o mosca blanca al chupar la savia. Busca los bichos en el envés y en los brotes, porque ahí está el problema de verdad. El polvito negro que a veces sale encima es un hongo que vive de la melaza: se quita con agua y jabón cuando ya no hay bichos.',
  },
  {
    id: 'necesita_agua',
    tema: 'riego',
    preguntas: ['cómo sé si necesita agua', 'cómo sé cuándo regar', 'la tierra está seca o mojada'],
    claves: ['saber', 'sé', 'necesita', 'seca', 'mojada', 'dedo', 'peso'],
    respuesta: () =>
      'Mete el dedo en la tierra hasta la segunda falange: si sale limpio y seco, casi todas ya quieren agua; si sale con tierra pegada, espera. Otro truco es levantar la maceta: mojada pesa mucho más que seca y con práctica se nota. Yo además llevo la cuenta de cuánta agua pierde cada una con el clima de tu zona, y te aviso el día que toca.',
  },
  {
    id: 'como_calcula',
    tema: 'riego',
    preguntas: ['cómo sabes cuándo regar', 'de dónde sacas cuánto regar', 'cómo calculas el agua'],
    claves: ['calculas', 'sabes', 'sacas', 'haces', 'calculo', 'cálculo', 'balance', 'evaporacion', 'app'],
    respuesta: () =>
      'Llevo un balance de agua de cada planta, como una cuenta de banco: cada día se le resta lo que pierde (según el calor, el sol y el viento de tu zona, y cuánto consume su especie) y se le suma lo que llueve y lo que tú registras que le echaste. Cuando la cuenta baja de lo que esa especie aguanta, te aviso; si está muy arriba, te digo que no la riegues. Por eso sirve tanto que registres cada riego.',
  },
  {
    id: 'cafe_huevo',
    preguntas: ['le pongo café a la tierra', 'cáscara de huevo como abono', 'agua de arroz para las plantas', 'plátano como abono'],
    claves: ['cafe', 'café', 'cascara', 'cáscara', 'huevo', 'arroz', 'platano', 'plátano', 'casero'],
    respuesta: () =>
      'Los remedios caseros ayudan poco y a veces estorban: el café molido encima de la tierra hace costra y le salen hongos; la cáscara de huevo tarda años en deshacerse (sirve más molida en la composta); el agua de arroz y la cáscara de plátano atraen mosquitos. Si quieres algo natural, la composta o el humus de lombriz, una capa delgada en primavera, es lo mejor.',
  },
  {
    id: 'jabon_neem',
    tema: 'plaga',
    preguntas: ['cómo hago jabón potásico', 'para qué sirve el aceite de neem', 'insecticida casero', 'repelente natural'],
    claves: ['jabon', 'jabón', 'potasico', 'potásico', 'neem', 'insecticida', 'casero', 'repelente'],
    respuesta: () =>
      'Jabón potásico: una cucharadita por litro de agua (o jabón neutro sin detergente), rociado en el envés de las hojas al atardecer, cada 5 días, tres veces. Mata por contacto a pulgón, cochinilla y mosca blanca. El aceite de neem (5 ml por litro con unas gotas de jabón para que se mezcle) además los repele y corta su ciclo. Pruébalo primero en una hoja: algunas plantas son sensibles.',
  },
  {
    id: 'hierbas_cocina',
    preguntas: ['cómo cosecho la albahaca', 'el cilantro se espigó', 'cómo hago que la hierbabuena se tupa', 'la albahaca echó flor'],
    claves: ['cosecho', 'cosechar', 'albahaca', 'cilantro', 'hierbabuena', 'espigo', 'espigó', 'tupa', 'tupida'],
    respuesta: () =>
      'Con las hierbas de cocina, cosechar es podar: corta siempre las puntas justo arriba de un par de hojas y la planta saca dos ramas donde había una. A la albahaca quítale las flores en cuanto salgan, o las hojas se amargan. El cilantro se espiga (sube a flor) con el calor: siémbralo en tandas cada tres semanas y a media sombra. La hierbabuena es invasiva: mejor sola en su maceta.',
  },
  {
    id: 'mover_planta',
    tema: 'luz',
    preguntas: ['puedo moverla de lugar', 'la cambio de lugar', 'dónde la acomodo mejor'],
    claves: ['mover', 'moverla', 'cambio', 'lugar', 'acomodo', 'reubicar'],
    respuesta: () =>
      'Sí, pero de a poco y sólo si el lugar nuevo le conviene más: cada cambio de luz la obliga a readaptar sus hojas, y algunas (como el ficus) tiran hojas por eso. Si la mueves, dímelo en su ficha para que ajuste el riego: en otra luz pierde otra cantidad de agua. Cuando el clima amenace, te aviso cuál conviene mover y a dónde.',
  },
];

// ---------------------------------------------------------------------------
// Búsqueda
// ---------------------------------------------------------------------------

const VACIAS = new Set(
  'a al algo ante como con cual cuales de del donde el ella ellas en entre es esa ese esta este esto hay la las le les lo los mas me mi mis muy no nos o para pero por que qué quien quién se si sin sobre su sus te tengo tiene tu tus un una uno unos unas y ya yo esta está están estan hace hago hacer puedo puede debo como cómo cuando cuándo cuanto cuánto porque por qué mucho poco planta plantas mata oye hola dime voy vas va van ir vamos'
    .split(' ')
    .map(normalizar),
);

export function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zñ0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Raíz burda: quita plurales y terminaciones comunes para que "amarillas" y "amarillo" se encuentren. */
function raiz(palabra: string): string {
  let p = palabra;
  // Pronombres pegados al verbo: "abonarlas" → "abonar", "regándole" → "regando".
  p = p.replace(/(ar|er|ir|ando|iendo)(las|los|les|la|lo|le|me|te|se)$/, '$1');
  for (const fin of ['aciones', 'acion', 'mente', 'ando', 'iendo', 'adas', 'ados', 'ada', 'ado', 'es', 's']) {
    if (p.length > fin.length + 3 && p.endsWith(fin)) {
      p = p.slice(0, -fin.length);
      break;
    }
  }
  // Infinitivos: "abonar" y "abono" tienen que encontrarse.
  if (p.length > 5 && /(ar|er|ir)$/.test(p)) p = p.slice(0, -2);
  if (p.length > 4 && /[aeio]$/.test(p)) p = p.slice(0, -1);
  return p;
}

export function fichas(texto: string): string[] {
  return normalizar(texto)
    .split(' ')
    .filter((t) => t.length > 1 && !VACIAS.has(t))
    .map(raiz);
}

interface Indice {
  docs: Array<{ entrada: Entrada; terminos: Map<string, number>; largo: number }>;
  df: Map<string, number>;
  promedio: number;
}

let indice: Indice | null = null;

function construir(): Indice {
  const docs = ENTRADAS.map((entrada) => {
    // Las claves pesan doble: son las palabras que definen el tema.
    const lista = [...entrada.preguntas.flatMap(fichas), ...entrada.claves.flatMap(fichas), ...entrada.claves.flatMap(fichas)];
    const terminos = new Map<string, number>();
    for (const t of lista) terminos.set(t, (terminos.get(t) ?? 0) + 1);
    return { entrada, terminos, largo: lista.length };
  });
  const df = new Map<string, number>();
  for (const d of docs) for (const t of d.terminos.keys()) df.set(t, (df.get(t) ?? 0) + 1);
  const promedio = docs.reduce((s, d) => s + d.largo, 0) / docs.length;
  return { docs, df, promedio };
}

export interface Hallazgo {
  id: string;
  puntaje: number;
  respuesta: string;
}

/** Qué tanto tiene que parecerse una pregunta para contestarla con esto. */
export const PUNTAJE_MINIMO = 3.2;

/**
 * La entrada que mejor contesta la pregunta, o `null` si ninguna se parece lo
 * suficiente. BM25: cuenta las palabras en común, pesando más las raras
 * ("cochinilla") que las comunes ("hojas").
 */
export function buscarSaber(pregunta: string, plantas: PlantaParaSaber[] = []): Hallazgo | null {
  if (!indice) indice = construir();
  const q = [...new Set(fichas(pregunta))];
  if (q.length === 0) return null;
  const N = indice.docs.length;
  const k1 = 1.2;
  const b = 0.6;
  let mejor: { entrada: Entrada; puntaje: number } | null = null;
  let segundo = 0;
  for (const d of indice.docs) {
    let s = 0;
    for (const t of q) {
      const f = d.terminos.get(t) ?? 0;
      if (f === 0) continue;
      const n = indice.df.get(t) ?? 0;
      const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
      s += (idf * f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.largo) / indice.promedio));
    }
    if (!mejor || s > mejor.puntaje) {
      segundo = mejor?.puntaje ?? 0;
      mejor = { entrada: d.entrada, puntaje: s };
    } else if (s > segundo) segundo = s;
  }
  if (!mejor || mejor.puntaje < PUNTAJE_MINIMO) return null;
  return { id: mejor.entrada.id, puntaje: Math.round(mejor.puntaje * 100) / 100, respuesta: mejor.entrada.respuesta(plantas) };
}

/** Con qué tema del modelo se traslapa una entrada, si con alguno. */
export function temaDeSaber(id: string): string | undefined {
  return ENTRADAS.find((e) => e.id === id)?.tema;
}

/** Cuántas cosas sabe. Para la prueba y para decirlo en la ayuda. */
export const TEMAS_DE_SABER = ENTRADAS.length;
