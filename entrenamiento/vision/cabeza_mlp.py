"""La última capa con una capa oculta, en formato 'medisina-cabeza-2'.

    python entrenamiento/vision/cabeza_mlp.py <r160> <oculta> <salida.json> [épocas]

<r160> es lo que dejó `volcar.js` (r160.bin y r160.meta.json). Sólo necesita
numpy. Aparta las mismas fotos de examen que `entrenar.ts` (el hash FNV del
nombre de la foto, uno de cada cinco), entrena con las demás y escribe la
cabeza con lo que sacó en el examen, ya con los pesos en bytes: la cifra que se
guarda es la del modelo que va en la app, no la del de laboratorio.
"""
import base64, json, sys, time
import numpy as np

prefijo = sys.argv[1]
oculta = int(sys.argv[2])
salida = sys.argv[3]
epocas = int(sys.argv[4]) if len(sys.argv) > 4 else 40

meta = json.load(open(f'{prefijo}.meta.json'))
n, v, dim, lado = meta['n'], meta['v'], meta['dim'], meta['lado']
X = np.fromfile(f'{prefijo}.bin', dtype=np.float32).reshape(n, v, dim)
especies = [m[0] for m in meta['meta']]
fotos = [m[1] for m in meta['meta']]
nombres = sorted(set(especies), key=lambda a: (a == 'otra', a))
idx = {s: i for i, s in enumerate(nombres)}
y = np.array([idx[s] for s in especies])
C = len(nombres)


def i32(x):
    x &= 0xFFFFFFFF
    return x - (1 << 32) if x >= (1 << 31) else x


def es_de_examen(foto):
    h = i32(2166136261)
    for ch in foto:
        h = i32(h ^ ord(ch))
        h = i32(h * 16777619)
    return abs(h) % 5 == 0


examen = np.array([es_de_examen(f) for f in fotos])
print('fotos', n, 'examen', int(examen.sum()), 'clases', C, flush=True)
Xtr = X[~examen].reshape(-1, dim)
ytr = np.repeat(y[~examen], v)
Xte = X[examen, 0]
yte = y[examen]


def softmax(z):
    z = z - z.max(1, keepdims=True)
    e = np.exp(z)
    return e / e.sum(1, keepdims=True)


def nll(P, yv):
    return -np.log(np.maximum(1e-12, P[np.arange(len(yv)), yv])).mean()


class Adam:
    def __init__(self, params, lr):
        self.p, self.lr, self.t = params, lr, 0
        self.m = [np.zeros_like(q) for q in params]
        self.v = [np.zeros_like(q) for q in params]

    def paso(self, grads, lr):
        self.t += 1
        for q, g, m, vv in zip(self.p, grads, self.m, self.v):
            m *= 0.9
            m += 0.1 * g
            vv *= 0.999
            vv += 0.001 * g * g
            q -= lr * (m / (1 - 0.9 ** self.t)) / (np.sqrt(vv / (1 - 0.999 ** self.t)) + 1e-8)


def pesos_clase(yv):
    c = np.bincount(yv, minlength=C).astype(np.float32)
    return (len(yv) / (C * np.maximum(c, 1))).astype(np.float32)


def entrenar(Xa, ya, oculta, l2=1e-4, lr=0.002, caida=0.5, caida_entrada=0.1, suavizado=0.1, semilla=0):
    rng = np.random.default_rng(semilla)
    media = Xa.mean(0)
    esc = 1 / np.sqrt(Xa.var(0) + 1e-6)
    W1 = (rng.standard_normal((dim, oculta)) * np.sqrt(2 / dim)).astype(np.float32)
    b1 = np.zeros(oculta, np.float32)
    W2 = (rng.standard_normal((oculta, C)) * np.sqrt(1 / oculta)).astype(np.float32)
    b2 = np.zeros(C, np.float32)
    opt = Adam([W1, b1, W2, b2], lr)
    pc = pesos_clase(ya)
    N = len(ya)
    total = epocas * ((N + 255) // 256)
    t = 0
    t0 = time.time()
    for e in range(epocas):
        orden = rng.permutation(N)
        for i in range(0, N, 256):
            k = orden[i:i + 256]
            xs = (Xa[k] - media) * esc
            xs = xs * (rng.random(xs.shape) > caida_entrada) / (1 - caida_entrada)
            h = xs @ W1 + b1
            a = np.maximum(h, 0)
            mascara = (rng.random(a.shape) > caida).astype(np.float32) / (1 - caida)
            ad = a * mascara
            P = softmax(ad @ W2 + b2)
            T = np.full((len(k), C), suavizado / C, np.float32)
            T[np.arange(len(k)), ya[k]] += 1 - suavizado
            G = (P - T) * pc[ya[k]][:, None] / len(k)
            gW2 = ad.T @ G + l2 * W2
            gb2 = G.sum(0)
            ga = (G @ W2.T) * mascara * (h > 0)
            gW1 = xs.T @ ga + l2 * W1
            gb1 = ga.sum(0)
            opt.paso([gW1, gb1, gW2, gb2], lr * 0.5 * (1 + np.cos(np.pi * t / total)))
            t += 1
        if e % 5 == 4:
            print(f'  época {e + 1}/{epocas} · {time.time() - t0:.0f} s', flush=True)
    # La normalización se mete en la primera capa: el teléfono no la hace aparte.
    W1f = (W1 * esc[:, None]).astype(np.float32)
    b1f = (b1 - (media * esc) @ W1).astype(np.float32)
    return W1f, b1f, W2, b2


def cuantizar(W):
    """W: (entradas, salidas). Por salida: uint8 con 128 de cero y su escala."""
    escalas = np.maximum(np.abs(W).max(0), 1e-12) / 127
    q = np.clip(np.round(W / escalas), -127, 127).astype(np.int16) + 128
    # Orden en bytes: salida por salida (como la cabeza 1).
    return q.T.astype(np.uint8), escalas.astype(np.float32)


def adelante(Z, W1, b1, W2, b2):
    return np.maximum(Z @ W1 + b1, 0) @ W2 + b2


t0 = time.time()
W1, b1, W2, b2 = entrenar(Xtr, ytr, oculta)
q1, e1 = cuantizar(W1)
q2, e2 = cuantizar(W2)
W1q = ((q1.astype(np.float32) - 128) * e1[:, None]).T
W2q = ((q2.astype(np.float32) - 128) * e2[:, None]).T

res = {}
for nombre, (A, B) in (('flotante', (W1, W2)), ('cuantizada', (W1q, W2q))):
    Z = adelante(Xte, A, b1, B, b2)
    mejor, T = 1e9, 1.0
    for t in np.arange(0.3, 4.01, 0.05):
        l = nll(softmax(Z / t), yte)
        if l < mejor:
            mejor, T = l, float(t)
    P = softmax(Z / T)
    orden = np.argsort(-P, axis=1)
    top1 = float((orden[:, 0] == yte).mean())
    top3 = float((orden[:, :3] == yte[:, None]).any(1).mean())
    seguras = []
    for u in (0.35, 0.5, 0.7, 0.85):
        s = P.max(1) >= u
        seguras.append({'umbral': u, 'aciertos': round(float((P.argmax(1)[s] == yte[s]).mean()), 3), 'cubre': round(float(s.mean()), 3)})
    res[nombre] = (top1, top3, T, seguras, mejor)
    print(f'{nombre:10s} top1 {top1 * 100:5.1f}  top3 {top3 * 100:5.1f}  nll {mejor:.3f}  T {T:.2f}  {seguras}', flush=True)

top1, top3, T, seguras, _ = res['cuantizada']
cabeza = {
    'formato': 'medisina-cabeza-2',
    'lado': int(lado),
    'clases': nombres,
    'dimension': dim,
    'oculta': oculta,
    'capa1': {
        'escalas': [float(f'{x:.6g}') for x in e1],
        'sesgos': [float(f'{x:.6g}') for x in b1],
        'bytes': base64.b64encode(q1.tobytes()).decode(),
    },
    'capa2': {
        'escalas': [float(f'{x:.6g}') for x in e2],
        'sesgos': [float(f'{x:.6g}') for x in b2],
        'bytes': base64.b64encode(q2.tobytes()).decode(),
    },
    'temperatura': round(T, 2),
    'examen': {'fotos': int(examen.sum()), 'top1': round(top1, 3), 'top3': round(top3, 3), 'seguras': seguras},
    'entrenadaEn': time.strftime('%Y-%m-%d'),
}
json.dump(cabeza, open(salida, 'w'), separators=(',', ':'))
print('escrita', salida, f'{time.time() - t0:.0f} s', flush=True)
