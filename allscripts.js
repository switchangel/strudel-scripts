register('o', (orbit, pat) => pat.orbit(orbit))
samples('http://localhost:5432')
setCpm(140 / 4)

// setGainCurve(x => x**2)
setGainCurve(x => Math.pow(x, 2))

function blockArrange(patArr, modifiers = []) {
  return stack(
    ...patArr.map(([pat, maskPat]) => {
      pat = [pat].flat()

      return maskPat.fmap(m => {
        return stack(...pat.map(p => {

          if (m == 0) {
            return
          }
          const ms = m.toString()
          let newPat = p

          if (ms.includes('R')) {
            newPat = newPat.restart(1)
          }
          if (ms.includes('B')) {
            newPat = newPat.rev().speed(-1)
          }
          modifiers.forEach(([mod, callback]) => {
            if (mod(ms)) {
              newPat = callback(newPat)
            }
          })
          return newPat
        }).filter(Boolean))
      }).innerJoin()
    }).flat()
  )
}

// example:
// $: blockArrange(
//     [ 
//       [[bd],       "<F F F F F F F F F 0>"],
//       [[bass],     "<0 0 F F F S F F F B>"],
//       [[hat],      "<0 F F F F F F F F F>"],    
//     ],
//     //ADD CUSTOM BINDINGS
//     [[(m) => m.includes('S') , (x) => x.stretch(1)]]
//   )._scope()

// fill in gaps between events
register('fill', function (pat) {
  return new Pattern(function (state) {
    const lookbothways = 1;
    // Expand the query window
    const haps = pat.query(state.withSpan(span => new TimeSpan(span.begin.sub(lookbothways), span.end.add(lookbothways))));
    const onsets = haps.map(hap => hap.whole.begin)
      // sort fractions
      .sort((a, b) => a.compare(b))
      // make unique
      .filter((x, i, arr) => i == (arr.length - 1) || x.ne(arr[i + 1]));
    const newHaps = [];
    for (const hap of haps) {
      // Ingore if the part starts after the original query
      if (hap.part.begin.gte(state.span.end)) {
        continue;
      }

      // Find the next onset, to use as an offset
      const next = onsets.find(onset => onset.gte(hap.whole.end));

      // Ignore if the part ended before the original query, and hasn't expanded inside
      if (next.lte(state.span.begin)) {
        continue;
      }

      const whole = new TimeSpan(hap.whole.begin, next);
      // Constrain part to original query
      const part = new TimeSpan(hap.part.begin.max(state.span.begin), next.min(state.span.end));
      newHaps.push(new Hap(whole, part, hap.value, hap.context, hap.stateful));
    }
    return newHaps;
  });
});

register('trancegate', (density, seed, length, x) => {
  return x.struct(rand.mul(density).round().seg(16).rib(seed, length)).fill().clip(.7)
})

// quantize notes to given values: pat.grab("e:f#:c")
register('grab', function (scale, pat) {
  // Supports ':' list syntax in mininotation
  scale = (Array.isArray(scale) ? scale.flat() : [scale]).flatMap((val) =>
    typeof val === 'number' ? val : noteToMidi(val) - 48
  );

  return pat.withHap((hap) => {
    const isObject = typeof hap.value === 'object';
    let note = isObject ? hap.value.n : hap.value;
    if (typeof note === 'number') {
      note = note;
    } else if (typeof note === 'string') {
      note = noteToMidi(note);
    }

    if (isObject) {
      delete hap.value.n; // remove n so it won't cause trouble
    }
    const octave = (note / 12) >> 0;
    const transpose = octave * 12;

    const goal = note - transpose;
    note =
      scale.reduce((prev, curr) => {
        return Math.abs(curr - goal) < Math.abs(prev - goal) ? curr : prev;
      }) + transpose;

    return hap.withValue(() => (isObject ? { ...hap.value, note } : note));
  });
});

setDefault('gain', 1)

// multi orbit pan for quad setups etc.
// ex: s("bd!4").mpan("3:4", slider(0.761))
register('mpan', (orbits, amount, pat) => {
  const index = Math.round(amount * (orbits.length - 1))
  const orbit = orbits[index]
  const pamt = (amount * orbits.length) % 1
  return pat.orbit(orbit).pan(pamt)
})

// lpf between 0 and 1
register('rlpf', (x, pat) => { return pat.lpf(pure(x).mul(12).pow(4)) })

//hpf between 0 and 1
register('rhpf', (x, pat) => { return pat.hpf(pure(x).mul(12).pow(4)) })

//@title velocity structure @by Switch Angel
register('vstruct', (ipat,pat) => {
  return ipat.outerBind(vel => {
    return pat.keepif.out(Math.ceil(vel)).velocity(vel)
  })
},false)

// sets my vocoder CC key to the specified value, probably only useful for me
register('voc', (key, x) => {
  let value;

  switch (key) {
    case 'f#': value = 0; break;
    case 'g': value = 0.1; break;
    case 'g#': value = 0.2; break;
    case 'a': value = 0.3; break;
    case 'a#': value = 0.4; break;
    case 'b': value = 0.45; break;
    case 'c': value = 0.5; break;
    case 'c#': value = 0.6; break;
    case 'd': value = 0.7; break;
    case 'd#': value = 0.8; break;
    case 'e': value = 0.9; break;
    case 'f': value = 1; break;
    default: value = 0.5; // fallback value if key is not recognized
  }

  return x.ccn(74).ccv(value).midi('tout');
});
// tb303 style filter envelope control between 0 & 1 values for useful range
register('acidenv', (x, pat) => pat.rlpf(.25).lpenv(x * 9).lps(.2).lpd(.15))


/** SOUNDS */

register('acid', (pat) => {
  return pat.s('supersaw')
    .detune(.5)
    .unison(1)
    .lpf(100)
    .lpsustain(0.2).lpd(.2).lpenv(2)
    .lpq(12)
})




$: s("white").clip(0).gain(0)



