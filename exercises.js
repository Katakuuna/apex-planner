// Exercise catalog and name matching. One exercise = one stable key, whatever it was called:
// «Жим лёжа», «жим лежа горизонтальный», «Жим штанги лёжа на скамье» and «Bench press» are all 'bench_press'.
// Key of a name: the user's manual link (S.exAlias) → catalog → the word signature of the name ('x:…').
// Workouts keep the names as typed; history, records, targets, groups and charts are joined by key.
// [id, ru, en, muscle group, ...aliases (ru or en)]
const EX_CAT=[
  ['bench_press','Жим штанги лёжа','Barbell bench press','Грудь','жим лёжа','жим лежа на горизонтальной скамье','жим штанги на горизонтальной скамье','жим на горизонтальной скамье','жим от груди лёжа','bench press','bench'],
  ['incline_bench_press','Жим штанги на наклонной','Incline barbell bench press','Грудь','жим на наклонной','жим лёжа на наклонной','жим штанги лёжа на наклонной скамье','incline bench press','incline bench'],
  ['decline_bench_press','Жим штанги на скамье с отрицательным наклоном','Decline bench press','Грудь','жим с отрицательным наклоном','жим головой вниз','decline bench press'],
  ['close_grip_bench_press','Жим лёжа узким хватом','Close-grip bench press','Трицепс','жим штанги узким хватом','жим узким хватом','close grip bench press'],
  ['db_bench_press','Жим гантелей лёжа','Dumbbell bench press','Грудь','жим гантелей','жим гантелей на горизонтальной скамье','dumbbell bench press','db bench press'],
  ['incline_db_press','Жим гантелей на наклонной','Incline dumbbell press','Грудь','жим гантелей лёжа на наклонной','жим гантелей на наклонной скамье','incline dumbbell press','incline db press'],
  ['db_fly','Разведения гантелей','Dumbbell fly','Грудь','разведения гантелей лёжа','разводка гантелей','разводка','dumbbell fly','dumbbell flyes'],
  ['cable_crossover','Сведения в кроссовере','Cable crossover','Грудь','кроссовер','сведение рук в кроссовере','cable fly','cable crossover'],
  ['pec_deck','Сведения в тренажёре','Pec deck','Грудь','бабочка','баттерфляй','сведения рук в тренажёре','pec deck','machine fly'],
  ['chest_press_machine','Жим в тренажёре','Machine chest press','Грудь','жим от груди в тренажёре','хаммер','жим в хаммере','chest press','machine chest press'],
  ['dips','Отжимания на брусьях','Dips','Грудь','брусья','отжимания на брусьях с весом','dips','chest dips'],
  ['push_up','Отжимания','Push-up','Грудь','отжимания от пола','push ups','pushups'],
  ['squat','Приседания со штангой','Barbell squat','Квадрицепс','приседания','присед','приседания со штангой на спине','back squat','squat'],
  ['front_squat','Фронтальные приседания','Front squat','Квадрицепс','фронтальный присед','приседания со штангой на груди','front squat'],
  ['hack_squat','Гакк-приседания','Hack squat','Квадрицепс','гакк','гак','гакк присед','hack squat'],
  ['bulgarian_split_squat','Болгарские выпады','Bulgarian split squat','Квадрицепс','болгарские приседания','болгарский сплит присед','bulgarian split squat'],
  ['leg_press','Жим ногами','Leg press','Квадрицепс','жим ногами в тренажёре','жим платформы ногами','leg press'],
  ['lunge','Выпады','Lunge','Квадрицепс','выпады с гантелями','выпады со штангой','lunges','walking lunges'],
  ['leg_extension','Разгибания ног','Leg extension','Квадрицепс','разгибание ног в тренажёре','разгибания ног сидя','leg extension'],
  ['leg_curl','Сгибания ног','Leg curl','Бицепс бедра','сгибание ног лёжа','сгибания ног в тренажёре','сгибания ног сидя','leg curl','lying leg curl','seated leg curl'],
  ['deadlift','Становая тяга','Deadlift','Спина','становая','тяга становая','классическая становая тяга','deadlift'],
  ['sumo_deadlift','Становая тяга сумо','Sumo deadlift','Спина','тяга сумо','сумо','sumo deadlift'],
  ['romanian_deadlift','Румынская тяга','Romanian deadlift','Бицепс бедра','румынская становая тяга','тяга на прямых ногах','мёртвая тяга','romanian deadlift','rdl','stiff leg deadlift'],
  ['hip_thrust','Ягодичный мост','Hip thrust','Ягодицы','ягодичный мостик','мост со штангой','hip thrust','glute bridge'],
  ['calf_raise','Подъёмы на носки','Calf raise','Икры','подъём на носки','икры стоя','подъёмы на носки стоя','calf raise','standing calf raise'],
  ['pull_up','Подтягивания','Pull-up','Спина','подтягивания на перекладине','подтягивания широким хватом','pull ups','pullups','chin ups'],
  ['lat_pulldown','Тяга верхнего блока','Lat pulldown','Спина','тяга верхнего блока к груди','вертикальная тяга','тяга вертикального блока','lat pulldown','pulldown'],
  ['barbell_row','Тяга штанги в наклоне','Barbell row','Спина','тяга в наклоне','тяга штанги к поясу','тяга штанги к поясу в наклоне','barbell row','bent over row'],
  ['db_row','Тяга гантели в наклоне','Dumbbell row','Спина','тяга гантели','тяга гантели одной рукой','тяга гантели к поясу','dumbbell row','one arm row'],
  ['seated_cable_row','Тяга горизонтального блока','Seated cable row','Спина','горизонтальная тяга','тяга нижнего блока','тяга блока к поясу','тяга нижнего блока к поясу','seated cable row','cable row'],
  ['t_bar_row','Т-тяга','T-bar row','Спина','тяга т-грифа','тяга т грифа','t bar row'],
  ['shrug','Шраги','Shrug','Спина','шраги со штангой','shrugs'],
  ['hyperextension','Гиперэкстензия','Back extension','Бицепс бедра','гиперэкстензии','back extension','hyperextension'],
  ['overhead_press','Жим стоя','Overhead press','Плечи','жим штанги стоя','армейский жим','жим штанги над головой','жим над головой','overhead press','ohp','military press'],
  ['db_shoulder_press','Жим гантелей сидя','Dumbbell shoulder press','Плечи','жим гантелей над головой','жим гантелей сидя на плечи','жим гантелей на плечи','dumbbell shoulder press','seated dumbbell press'],
  ['lateral_raise','Махи гантелями в стороны','Lateral raise','Плечи','махи в стороны','махи гантелями','разведения гантелей в стороны','подъём гантелей в стороны','lateral raise','side raise'],
  ['rear_delt_fly','Разведения в наклоне','Rear delt fly','Плечи','разведения гантелей в наклоне','махи в наклоне','обратная бабочка','обратные разведения','rear delt fly','reverse fly'],
  ['face_pull','Тяга к лицу','Face pull','Плечи','тяга каната к лицу','face pull'],
  ['upright_row','Тяга к подбородку','Upright row','Плечи','тяга штанги к подбородку','протяжка','upright row'],
  ['barbell_curl','Сгибания на бицепс','Barbell curl','Бицепс','подъём штанги на бицепс','сгибания рук со штангой','сгибания со штангой','бицепс со штангой','barbell curl','biceps curl'],
  ['db_curl','Сгибания с гантелями','Dumbbell curl','Бицепс','подъём гантелей на бицепс','сгибания рук с гантелями','бицепс с гантелями','dumbbell curl'],
  ['hammer_curl','Молотки','Hammer curl','Бицепс','молот','сгибания молот','молотковые сгибания','hammer curl'],
  ['preacher_curl','Сгибания на скамье Скотта','Preacher curl','Бицепс','скамья скотта','скотт','preacher curl'],
  ['skull_crusher','Французский жим','Skull crusher','Трицепс','французский жим лёжа','французский жим со штангой','skull crusher','lying triceps extension'],
  ['triceps_pushdown','Разгибания на блоке','Triceps pushdown','Трицепс','разгибания рук на блоке','разгибание на трицепс на блоке','трицепс на блоке','разгибания на трицепс','pushdown','triceps pushdown'],
  ['overhead_triceps_extension','Разгибания из-за головы','Overhead triceps extension','Трицепс','французский жим сидя','разгибание руки из-за головы','overhead triceps extension'],
  ['crunch','Скручивания','Crunch','Пресс','скручивания на пресс','crunches'],
  ['hanging_leg_raise','Подъёмы ног в висе','Hanging leg raise','Пресс','подъём ног в висе','подъёмы ног','hanging leg raise'],
  ['plank','Планка','Plank','Пресс','plank'],
  ['treadmill','Беговая дорожка','Treadmill','Кардио','дорожка','бег на дорожке','treadmill'],
  ['run','Бег','Running','Кардио','пробежка','running','run'],
  ['bike','Велотренажёр','Stationary bike','Кардио','велосипед','вело','bike','cycling'],
  ['elliptical','Эллипс','Elliptical','Кардио','эллипсоид','орбитрек','elliptical'],
];
const EX_ID=Object.fromEntries(EX_CAT.map(c=>[c[0],{id:c[0],ru:c[1],en:c[2],g:c[3]}]));

// words that don't change the exercise: the barbell is the default, «горизонтальный», «классический», «на скамье» etc.
const EX_STOP=new Set('в во на с со к ко у за из до для по от при и a an the of on in at with'.split(' '));
const EX_FILLER=/^(горизонтальн|классическ|обычн|стандартн|штанг|скам|скамейк|barbell|bb|flat|classic|standard|regular)/;
const RU_END=/(ями|ами|ыми|ими|ых|их|ым|им|ую|юю|его|ого|ему|ому|ой|ей|ий|ый|ая|яя|ое|ее|ые|ие|ом|ем|ам|ям|ах|ях|ов|ев|ью|ия|ии|ю|у|а|я|ы|и|е|о|й|ь)$/;
const exNorm=s=>String(s??'').toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();
const exStem=w=>/[а-я]/.test(w)?(w.length>3&&RU_END.test(w)&&w.replace(RU_END,'').length>=3?w.replace(RU_END,''):w).slice(0,6)
  :(w.length>3&&/[^s]s$/.test(w)?w.slice(0,-1):w);
// order-free signature of the meaningful words: «жим лежа горизонтальный» and «Жим лёжа» are both 'жим леж'
function exSig(n){const t=n.split(' ').filter(w=>w&&!EX_STOP.has(w)&&!EX_FILLER.test(w)).map(exStem);return [...new Set(t)].sort().join(' ')||n}
const EX_BY_SIG=new Map();
for(const [id,ru,en,,...a] of EX_CAT)for(const n of [ru,en,...a]){const s=exSig(exNorm(n));if(!EX_BY_SIG.has(s))EX_BY_SIG.set(s,id)}
const exAuto=new Map();
// key of a normalized name before the user's merges and splits
function exAutoKey(n){let k=exAuto.get(n);if(!k){const s=exSig(n);k=EX_BY_SIG.get(s)||'x:'+s.slice(0,78);exAuto.set(n,k)}return k}
// the stable key of an exercise name; keys pass through unchanged, so exKey(exKey(x)) === exKey(x)
function exKey(name){
  const A=S.exAlias||{};let k;
  if(EX_ID[name]||/^[xn]:/.test(name))k=name;
  else{const n=exNorm(name);k=A[n]||exAutoKey(n)}
  for(let i=0;i<8&&A[k];i++)k=A[k]; // a merged exercise points at the one it was merged into
  return k;
}
