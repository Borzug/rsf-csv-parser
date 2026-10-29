/**
 * Флаги стран по коду ISO alpha-2 из CSV (колонка Nationality).
 * SVG из flag-icons (MIT, flags/LICENSE) лежат в папке flags/ рядом со страницей.
 */
import { createElement } from './dom';

/** Коды, для которых есть файл, — чтобы не запрашивать несуществующие. */
const AVAILABLE = new Set(
    'ad ae af ag ai al am ao aq ar arab as asean at au aw ax az ba bb bd be bf bg bh bi bj bl bm bn bo bq br bs bt bv bw by bz ca cc cd cefta cf cg ch ci ck cl cm cn co cp cr cu cv cw cx cy cz de dg dj dk dm do dz eac ec ee eg eh er es-ct es-ga es-pv es et eu fi fj fk fm fo fr ga gb-eng gb-nir gb-sct gb-wls gb gd ge gf gg gh gi gl gm gn gp gq gr gs gt gu gw gy hk hm hn hr ht hu ic id ie il im in io iq ir is it je jm jo jp ke kg kh ki km kn kp kr kw ky kz la lb lc li lk lr ls lt lu lv ly ma mc md me mf mg mh mk ml mm mn mo mp mq mr ms mt mu mv mw mx my mz na nc ne nf ng ni nl no np nr nu nz om pa pc pe pf pg ph pk pl pm pn pr ps pt pw py qa re ro rs ru rw sa sb sc sd se sg sh-ac sh-hl sh-ta sh si sj sk sl sm sn so sr ss st sv sx sy sz tc td tf tg th tj tk tl tm tn to tr tt tv tw tz ua ug um un us uy uz va vc ve vg vi vn vu wf ws xk xx ye yt za zm zw'.split(' '),
);

/** Иконка флага или null, если кода нет или флага для него нет. */
export function createFlag(country: string): HTMLImageElement | null {
    const code = country.trim().toLowerCase();
    if (!AVAILABLE.has(code)) return null;
    const img = createElement('img', 'flag');
    img.src      = `flags/${code}.svg`;
    img.alt      = country.toUpperCase();
    img.title    = country.toUpperCase();
    img.width    = 16;
    img.height   = 12;
    img.loading  = 'lazy';
    img.decoding = 'async';
    return img;
}

/** Ставит флаг первым в элементе с именем участника. */
export function prependFlag(el: HTMLElement, country: string): void {
    const flag = createFlag(country);
    if (flag) el.prepend(flag);
}
