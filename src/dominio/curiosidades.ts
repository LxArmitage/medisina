/**
 * Lo que vale la pena contar de cada planta.
 *
 * Cuidar una planta que no conoces es una tarea; cuidar una de la que sabes
 * que su flor abre una sola noche, o que el rojo de la nochebuena no es flor,
 * es otra cosa. Estos datos son para eso: para que la planta deje de ser "la
 * de la maceta verde" y se vuelva una que tiene historia.
 *
 * REGLAS DE CONTENIDO, las mismas del conocimiento (`conocimiento.ts`): nada
 * de usos medicinales para personas, y nada que no se pueda sostener. Una
 * leyenda se cuenta como leyenda. Si un dato no es seguro, no entra.
 */

const C: Record<string, string[]> = {
  'lophocereus-schottii': [
    'Se dice que "sina" o "senita" quiere decir "la viejita": las puntas de los brazos viejos se cubren de espinas largas y grises, como canas.',
    'Tiene un trato con una polilla: la polilla de la sina la poliniza de noche y, a cambio, pone sus huevos en la flor.',
    'Es del desierto de Sonora: crece silvestre en Sonora, Baja California y un poco de Arizona.',
  ],
  'opuntia-ficus-indica': [
    'Está en la bandera de México: el águila del escudo está parada sobre un nopal.',
    'Sus pencas son tallos, no hojas. Las hojas de verdad son unas escamitas que se le caen cuando la penca está tierna.',
    'En el nopal vive la grana cochinilla, un insecto con el que en la Colonia se hacía uno de los tintes rojos más valiosos del mundo.',
    'Las tunas pueden ser verdes, amarillas, rojas o moradas, según la variedad.',
  ],
  'aloe-vera': [
    'No es un cactus: es pariente lejano de los espárragos y los agaves.',
    'Guarda agua en el gel de sus hojas; por eso aguanta semanas sin riego.',
    'Echa hijitos alrededor de la base: cada uno se puede separar con su raíz y plantar aparte.',
  ],
  'monstera-deliciosa': [
    'Es de las selvas del sur de México y Centroamérica: es tan mexicana como el cempasúchil.',
    'Su fruto se come bien maduro y sabe a piña con plátano; verde irrita la boca por sus cristalitos de oxalato.',
    'Se cree que los agujeros de sus hojas la ayudan a aguantar el viento y a dejar pasar luz a las hojas de abajo.',
    'Sus raíces aéreas le sirven para agarrarse de los árboles y subir hacia la luz.',
  ],
  'epipremnum-aureum': [
    'Trepando un árbol en su selva, sus hojas llegan a medir casi un metro; en maceta rara vez pasan de la palma de la mano.',
    'Casi nunca florece, ni siquiera en la naturaleza: se multiplica sobre todo por pedacitos de tallo.',
    'En inglés le dicen "hiedra del diablo" porque es casi imposible de matar y sigue verde aun con muy poca luz.',
  ],
  'dracaena-trifasciata': [
    'Abre sus poros de noche y los cierra de día (fotosíntesis CAM): así pierde muy poca agua.',
    'De sus hojas se sacaba fibra para cuerdas de arco; en inglés también se le llama "bowstring hemp".',
    'Antes se llamaba Sansevieria; hace unos años los botánicos la pasaron al género Dracaena.',
  ],
  'citrus-limon': [
    'El limón amarillo y el "limón" verde que se usa en México son especies distintas: el nuestro es el limón mexicano (Citrus aurantiifolia).',
    'Puede tener flores, limones verdes y limones maduros al mismo tiempo.',
    'Un limón tarda de 6 a 9 meses en madurar desde que cae la flor.',
    'Sus flores blancas son azahares: huelen igual que las del naranjo.',
  ],
  'bougainvillea-glabra': [
    'Lo que parece flor son brácteas, hojas de colores. La flor de verdad es el tubito blanco del centro.',
    'Se llama así por el explorador francés Bougainville; en su viaje, Jeanne Baret, la primera mujer en darle la vuelta al mundo, ayudó a encontrarla en Brasil.',
    'Florece más cuando pasa un poco de sed: con mucha agua echa pura hoja.',
  ],
  'ocimum-basilicum': [
    'Su nombre viene del griego "basilikón": real, digna de un rey.',
    'Si le cortas las flores en cuanto salen, sigue echando hojas por más tiempo.',
    'Es de la familia de la menta: fíjate en su tallo, es cuadrado.',
  ],
  'nephrolepis-exaltata': [
    'No tiene flores ni semillas: se reproduce por esporas, los puntitos cafés debajo de sus hojas.',
    'Los helechos ya existían más de cien millones de años antes que los dinosaurios.',
    'Su nombre viene de Boston: en 1894 apareció ahí una variedad de frondas arqueadas que se volvió la favorita de las casas.',
  ],
  'hibiscus-rosa-sinensis': [
    'Cada flor dura abierta uno o dos días, pero la planta saca flores nuevas casi sin parar.',
    'Es la flor nacional de Malasia.',
    'El agua de jamaica no sale de esta planta: sale de su prima, Hibiscus sabdariffa.',
  ],
  'jasminum-sambac': [
    'Es la flor nacional de Filipinas, donde le dicen sampaguita.',
    'Sus flores abren al atardecer y es de noche cuando más huelen.',
    'Con sus flores se perfuma el té de jazmín en China.',
  ],
  'rosa-hybrida': [
    'Lo que pica no son espinas sino aguijones: salen de la piel del tallo y se desprenden fácil.',
    'Hay fósiles de rosas de más de 30 millones de años.',
    'Si dejas la flor seca, se forma su fruto: una bolita roja llamada escaramujo.',
  ],
  'ficus-benjamina': [
    'En su tierra es un árbol de hasta 30 metros, con raíces que bajan desde las ramas.',
    'Es el árbol símbolo de Bangkok, la capital de Tailandia.',
    'Tira hojas cuando la cambias de lugar: se está acostumbrando a la nueva luz.',
  ],
  'nymphaea-mexicana': [
    'Es nativa de México y del sur de Estados Unidos: de ahí su nombre.',
    'Sus hojas flotan gracias al aire que guardan por dentro, y tiene los poros arriba, no abajo como casi todas.',
    'Sus flores abren hacia el mediodía y se cierran por la tarde.',
  ],
  'zamioculcas-zamiifolia': [
    'Guarda agua en unos tubérculos gruesos bajo la tierra: por eso aguanta un mes sin riego.',
    'Cada tallo es una sola hoja: lo que parecen hojitas son sus folíolos.',
    'Una sola hojita que se caiga puede echar raíz y volverse una planta nueva.',
  ],
  'chlorophytum-comosum': [
    'Le dicen "mala madre" porque avienta a sus hijos: los echa colgando en varas largas.',
    'Sus hijitos ya traen raíces: basta ponerlos en tierra o en un vaso con agua.',
    'Es de las pocas plantas de casa que no son tóxicas para perros y gatos.',
  ],
  'spathiphyllum-wallisii': [
    'Lo blanco no es un pétalo: es una hoja especial, la espata, que protege las florecitas de la colita del centro.',
    'Cuando le falta agua se desmaya completita, y unas horas después de regarla se vuelve a levantar.',
    'Es pariente de la monstera y del anturio: todas son aráceas.',
  ],
  'echeveria-elegans': [
    'Es mexicana: crece silvestre en los cerros de Hidalgo.',
    'El polvito blanco de sus hojas la protege del sol; si lo tocas se borra y ya no vuelve.',
    'Una sola hoja que se desprenda puede formar una rosetita nueva.',
  ],
  'sedum-morganianum': [
    'Es mexicana, pero nunca se ha encontrado silvestre: sólo se conoce cultivada.',
    'Sus hojitas se caen con sólo rozarlas, y cada una puede echar raíz.',
    'Sus tallos pueden colgar hasta casi un metro.',
  ],
  'crassula-ovata': [
    'Abre sus poros de noche para perder menos agua, como los cactus.',
    'Con sol fuerte, la orilla de sus hojas se pone roja: es como un bronceado.',
    'Vive muchas décadas; hay plantas de jade que pasan de abuelos a nietos.',
  ],
  'agave-americana': [
    'Florece una sola vez en su vida: saca un quiote de varios metros y después muere.',
    'En inglés le dicen "planta del siglo" porque se creía que tardaba cien años en florecer; en realidad son de 10 a 30.',
    'Del maguey pulquero sale el aguamiel, que fermentado se vuelve pulque.',
  ],
  'beaucarnea-recurvata': [
    'Es del oriente de México, y aunque le digan palma, no lo es: es pariente de los agaves.',
    'Su base abultada es un tanque de agua para las sequías.',
    'Crece muy despacio: las grandes de los jardines pueden tener muchas décadas.',
  ],
  'euphorbia-pulcherrima': [
    'Es mexicana: los mexicas la llamaban cuetlaxóchitl y la usaban para teñir de rojo.',
    'Lo rojo son hojas (brácteas); la flor de verdad son las bolitas amarillas del centro.',
    'Para pintarse de rojo necesita noches largas: más de 12 horas de oscuridad durante varias semanas.',
    'En inglés se llama poinsettia por Joel Poinsett, el primer embajador de Estados Unidos en México.',
  ],
  'tagetes-erecta': [
    'Su nombre viene del náhuatl cempōhualxōchitl: "flor de veinte pétalos", o de muchos.',
    'Según la tradición, su color y su olor guían a las almas en Día de Muertos.',
    'Sus pétalos se dan a las gallinas para que la yema del huevo salga más amarilla.',
  ],
  'salvia-rosmarinus': [
    'Su nombre en latín, "ros marinus", quiere decir "rocío del mar": crece junto a la costa del Mediterráneo.',
    'Hasta 2017 se llamaba Rosmarinus officinalis; ahora los botánicos la cuentan entre las salvias.',
    'Florece en invierno, cuando hay pocas flores, y por eso las abejas la buscan tanto.',
  ],
  'mentha-spicata': [
    'Es muy invasora: sus tallos corren bajo tierra, así que mejor tenla sola en su maceta.',
    'Su frescura viene de la carvona, un aroma distinto al mentol de la menta piperita.',
    'Es la hierba del mojito y del té de hierbabuena marroquí.',
  ],
  'coriandrum-sativum': [
    'A algunas personas les sabe a jabón: tienen un gen que las hace muy sensibles a uno de sus aromas.',
    'Sus semillas se llaman coriandro y saben distinto que las hojas: a cítrico.',
    'Con calor se "espiga": florea rápido y sus hojas se vuelven finitas como hilos.',
  ],
  'capsicum-annuum': [
    'Lo que pica es la capsaicina, que se concentra en las venas blancas de adentro, no en las semillas.',
    'México es su centro de domesticación: aquí se cultiva desde hace unos 6,000 años.',
    'Las aves no sienten el picor; por eso comen chiles y reparten sus semillas.',
  ],
  'persea-americana': [
    'La palabra aguacate viene del náhuatl ahuacatl.',
    'El aguacate no madura en el árbol: empieza a madurar hasta que lo cortas.',
    'Sus flores abren un día como hembra y al día siguiente como macho.',
    'De semilla puede tardar de 5 a 13 años en dar fruto; injertado, 3 o 4.',
  ],
  'ficus-elastica': [
    'Con su savia lechosa se hacía hule antes de que se usara el árbol del caucho de Brasil.',
    'Cada hoja nueva sale envuelta en una funda roja que después se cae.',
    'En la India, sus raíces se guían por años sobre los ríos hasta formar puentes vivos.',
  ],
  'dracaena-fragrans': [
    'A pesar de su nombre no es de Brasil: es de África tropical.',
    'Sus flores casi nunca salen en casa, pero cuando lo hacen huelen muy fuerte de noche; por eso "fragrans".',
    'Un trozo de tronco puesto de pie en agua echa brotes nuevos por los lados.',
  ],
  'chamaedorea-elegans': [
    'Es mexicana, de las selvas del sur, y es de las palmas de interior más vendidas del mundo.',
    'Es de las pocas palmas que aguantan poca luz.',
    'Sus hojas se cortan en la selva para arreglos florales; a esas hojas se les llama xate.',
  ],
  'dypsis-lutescens': [
    'Sus tallos amarillos con anillos parecen cañas de bambú: por eso le dicen palmera bambú.',
    'Crece en macollos: cada maceta suele traer varias plantitas juntas.',
    'Es de Madagascar, una isla con casi 200 especies de palmas que no existen en ningún otro lugar.',
  ],
  'pelargonium-hortorum': [
    'No es un geranio de verdad: es un Pelargonium, pariente de los geranios silvestres.',
    'Es de Sudáfrica.',
    'Tiene primos cuyas hojas huelen a limón, a rosa o a menta con sólo frotarlas.',
  ],
  'kalanchoe-blossfeldiana': [
    'Es de Madagascar.',
    'Florece cuando las noches se alargan, igual que la nochebuena.',
    'Sus flores duran varias semanas abiertas.',
  ],
  phalaenopsis: [
    'La vainilla también es una orquídea, y es mexicana.',
    'Sus raíces grises que se salen de la maceta son normales: en la selva cuelgan de los árboles y toman agua del aire.',
    'Las orquídeas son una de las familias de plantas más grandes: hay unas 28,000 especies.',
    'Una vara floral puede durar de dos a tres meses con flores.',
  ],
  'anthurium-andraeanum': [
    'Lo rojo brillante es una hoja modificada, la espata; las florecitas de verdad están en la colita del centro.',
    'Cada "flor" dura hasta dos meses en la planta.',
    'Es de las selvas de Colombia y Ecuador.',
  ],
  'tradescantia-zebrina': [
    'Es nativa de México y Centroamérica.',
    'Cualquier pedacito de tallo echa raíz en agua en unos días.',
    'Con más luz se pone más morada; con poca, más verde.',
  ],
  'dieffenbachia-seguine': [
    'En inglés le dicen "caña muda": su savia inflama la boca y cuesta hablar.',
    'Es de la América tropical.',
    'Siempre busca la luz: gira la maceta para que no se chuequee.',
  ],
  'syngonium-podophyllum': [
    'Sus hojas cambian con la edad: de punta de flecha a una hoja partida en varios lóbulos, como una manita.',
    'Es nativa de México y Centroamérica.',
    'Es trepadora: con un palo de musgo donde agarrarse, sus hojas crecen más grandes.',
  ],
  'philodendron-hederaceum': [
    'Philodendron quiere decir "que ama los árboles" en griego: trepa por ellos.',
    'Es nativa de América, de México a Brasil.',
    'Se distingue del potos porque sus hojas nuevas salen de una funda y tienen forma de corazón perfecto.',
  ],
  'codiaeum-variegatum': [
    'Una misma planta puede tener hojas verdes, amarillas, naranjas, rojas y hasta moradas.',
    'Entre más sol recibe, más colores saca.',
    'Su savia blanca irrita la piel.',
  ],
  'coleus-scutellarioides': [
    'Sus colores son de las hojas, no de flores: hay cientos de variedades.',
    'Si le cortas las espigas de flor, se pone más frondoso.',
    'Es pariente de la menta y la albahaca: tiene el tallo cuadrado.',
  ],
  'schefflera-arboricola': [
    'Cada hoja son de 7 a 9 hojitas en círculo, como las varillas de un paraguas.',
    'Es de Taiwán y de la isla de Hainan, en China.',
    'Aguanta la poda fuerte; por eso se usa mucho para bonsái.',
  ],
  'aglaonema-commutatum': [
    'En Asia se considera de buena suerte.',
    'Es de las que mejor aguantan poca luz; las de hojas más claras piden un poco más.',
    'Crece despacio: saca pocas hojas nuevas al año.',
  ],
  'catharanthus-roseus': [
    'Es de Madagascar, pero hoy se ve en casi todos los trópicos del mundo.',
    'Aguanta sol fuerte y calor, y florece casi todo el año.',
    'Sus cinco pétalos giran como una hélice.',
  ],
  'portulaca-grandiflora': [
    'Le dicen "amor de un rato" porque sus flores abren con el sol y se cierran por la tarde.',
    'Es prima de la verdolaga que se come en México.',
    'Combina dos formas de hacer fotosíntesis, algo muy raro, para aguantar calor y sequía.',
  ],
  'solanum-lycopersicum': [
    '"Jitomate" viene del náhuatl xītomatl; tomate, de tomatl.',
    'Técnicamente es una fruta: una baya.',
    'Es pariente de la papa, la berenjena y el chile.',
    'Sus hojas huelen fuerte porque tienen pelitos llenos de aceites.',
  ],
  'cycas-revoluta': [
    'No es una palma: es una cícada, un grupo de plantas que ya existía con los dinosaurios.',
    'Es muy tóxica para perros y gatos, sobre todo sus semillas.',
    'Saca sus hojas nuevas de golpe, todas juntas, en una corona.',
  ],
  'euphorbia-milii': [
    'Según la leyenda, la corona de espinas de Jesús era de esta planta.',
    'Lo colorido son brácteas; la flor de verdad es chiquita, al centro.',
    'Es de Madagascar, y su savia blanca irrita la piel.',
  ],
  'nerium-oleander': [
    'Es de las plantas de jardín más tóxicas: todas sus partes, y hasta el humo si se quema.',
    'Aguanta sequía, sal y contaminación; por eso se ve tanto en camellones.',
    'Es del Mediterráneo y del sur de Asia.',
  ],
  mammillaria: [
    'Hay unas 200 especies y casi todas son mexicanas.',
    'Sus flores salen en corona alrededor de la cabeza, no en la punta.',
    'Su nombre viene de sus tubérculos, que tienen forma de pezón (mamila, en latín).',
  ],
  'tradescantia-spathacea': [
    'Le dicen "moisés en la cuna" porque sus florecitas blancas nacen dentro de unas hojitas en forma de barca.',
    'Es nativa del sur de México y Centroamérica.',
    'Su savia puede irritar la piel.',
  ],
  'mangifera-indica': [
    'Es de la India, donde se cultiva desde hace miles de años; a México llegó, entre otros caminos, en el galeón que venía de Filipinas.',
    'México es el mayor exportador de mango del mundo.',
    'Es pariente del pirul: su cáscara puede dar alergia en la boca a algunas personas.',
  ],
  'plumeria-rubra': [
    'Los mexicas la llamaban cacaloxóchitl, "flor del cuervo". Es nativa de México y Centroamérica.',
    'Sus flores no tienen néctar: engañan a las polillas con su perfume.',
    'En Hawái sus flores se usan para hacer los collares de bienvenida.',
  ],
  'selenicereus-undatus': [
    'Su flor es enorme, de hasta 30 cm: abre una sola noche y se cierra al amanecer.',
    'Es un cactus trepador: con raíces aéreas se agarra de árboles, muros y postes.',
    'Hay pitahayas de pulpa blanca, roja y amarilla; las semillitas negras se comen con todo y fruta.',
    'Es de México y Centroamérica, pero hoy el país que más la vende al mundo es Vietnam.',
  ],
  'ficus-lyrata': [
    'Sus hojas tienen forma de violín: de ahí "lyrata" y su nombre en inglés, "fiddle leaf".',
    'En su tierra, el oeste de África, empieza su vida creciendo encima de otros árboles.',
    'Es muy sensible a los cambios: si la mueves de lugar, puede tirar hojas.',
  ],
  'strelitzia-reginae': [
    'Su flor parece la cabeza de un ave; cuando un pájaro se para en ella, se abre y le embarra polen en las patas.',
    'Se llama así por la reina Carlota de Mecklemburgo-Strelitz, esposa del rey Jorge III de Inglaterra.',
    'Es de Sudáfrica, y es la flor oficial de la ciudad de Los Ángeles.',
  ],
  lavandula: [
    'Su nombre vendría del latín "lavare", lavar: los romanos perfumaban con ella el agua del baño.',
    'A las abejas les encanta; en Provenza, Francia, hay campos enteros pintados de morado.',
    'En suelo seco y pobre crece más compacta y huele más.',
  ],
  'cymbopogon-citratus': [
    'Su olor a limón viene del citral, el mismo aroma de la cáscara del limón.',
    'Es un pasto: pariente del maíz y de la caña de azúcar.',
    'Casi nunca da flores cultivada; se multiplica dividiendo la mata.',
  ],
  'ruta-graveolens': [
    'Su savia, con el sol, puede causar quemaduras con ampollas en la piel.',
    'En México es parte de las "limpias" de la tradición popular.',
    'Sus hojas son de un verde azulado y huelen muy fuerte, casi amargo.',
  ],
  'echinocactus-grusonii': [
    'Es mexicana, de Querétaro e Hidalgo, y está en peligro en su hábitat aunque en los viveros sobre.',
    'Con los años puede medir casi un metro, con decenas de costillas y espinas doradas.',
    'Tarda muchos años en florecer; sus flores amarillas salen de la corona lanuda de arriba.',
  ],
  'pilea-peperomioides': [
    'Durante décadas se repartió por el mundo de mano en mano, con hijitos, antes de venderse en viveros.',
    'Es del suroeste de China, de las montañas de Yunnan y Sichuan.',
    'Sus hojas son "peltadas": el tallito se pega al centro de la hoja, no a la orilla.',
  ],
  'dracaena-marginata': [
    'Sus hojas tienen un filo rojo: por eso "marginata", con margen.',
    'Es de Madagascar.',
    'Sus tallos se pueden torcer y trenzar mientras son jóvenes.',
  ],
  'helianthus-annuus': [
    'De joven sigue al sol durante el día; ya en flor, se queda mirando hacia el oriente.',
    'Cada "flor" es en realidad cientos de florecitas; cada una de las del centro se vuelve una semilla.',
    'Las semillas del centro forman espirales que siguen la sucesión de Fibonacci.',
    'Es de Norteamérica: se cultivaba mucho antes de que llegaran los europeos.',
  ],
  'hoya-carnosa': [
    'Sus flores parecen de cera o de porcelana, y sueltan gotitas de néctar.',
    'Huele más de noche.',
    'No le cortes los tallitos donde ya floreció: de ahí mismo vuelve a florecer.',
  ],
  'gardenia-jasminoides': [
    'Es de China y Japón; su perfume es uno de los más famosos de la perfumería.',
    'Si cambia mucho la temperatura o le falta agua, tira los botones antes de abrir.',
    'Se llama así por Alexander Garden, un naturalista escocés.',
  ],
  'carica-papaya': [
    'Es nativa del sur de México y Centroamérica.',
    'No es un árbol de verdad: su tronco es blando, casi sin madera.',
    'Su látex tiene papaína, una enzima que ablanda la carne.',
    'De semilla puede dar fruta en menos de un año.',
  ],
  'psidium-guajava': [
    'Es nativa de la América tropical.',
    'Tiene varias veces más vitamina C que la naranja.',
    'Su corteza se pela en placas y deja ver un tronco liso, color canela.',
    'Sus flores blancas tienen cientos de estambres, como una borla.',
  ],
  musa: [
    'No es un árbol: es la hierba más grande del mundo, y su "tronco" son hojas enrolladas.',
    'El plátano que comemos no tiene semillas: todas las plantas salen de hijuelos, son clones.',
    'Cada tallo da un solo racimo y luego se seca; los hijos de al lado dan los siguientes.',
    'La flor morada que cuelga al final del racimo se come en varios países de Asia.',
  ],
};

/** Los datos curiosos de una especie. Las genéricas no tienen: no hay de quién hablar. */
export function curiosidadesDe(especieId: string): string[] {
  return C[especieId] ?? [];
}

/** Qué especies tienen datos. Para la prueba que cuida el catálogo. */
export function especiesConCuriosidades(): string[] {
  return Object.keys(C);
}

/**
 * Un dato por día, el mismo todo el día y distinto al siguiente.
 *
 * Con `semilla` (el id de la planta) dos plantas de la misma especie no dicen
 * lo mismo el mismo día.
 */
export function datoDelDia(especieId: string, fecha: Date, semilla = ''): string | undefined {
  const datos = curiosidadesDe(especieId);
  if (datos.length === 0) return undefined;
  const dia = Math.floor(Date.UTC(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()) / 86_400_000);
  let h = 0;
  for (let i = 0; i < semilla.length; i += 1) h = (h * 31 + semilla.charCodeAt(i)) >>> 0;
  return datos[(dia + h) % datos.length];
}
