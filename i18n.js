// Interface language. The Russian text is the key: tx('Сохранить') returns it as is in Russian and the EN entry in English,
// so both languages always show the same set of labels and a missing entry falls back to Russian.
// Data is stored in Russian (exercise, food, muscle group names) and only translated for display.
let LANG='ru';
const LOC=()=>LANG==='en'?'en-GB':'ru-RU';
function tx(s,...a){const r=LANG==='en'&&EN[s]||s;return a.length?r.replace(/\{(\d)\}/g,(_,i)=>a[i]):r}

// static markup (header, nav, dialogs): text nodes and labels are translated in place, originals kept for switching back
const ORIG=new WeakMap(),ATTRS=['placeholder','title','aria-label'];
function applyStatic(root=document.body){
  const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT|NodeFilter.SHOW_ELEMENT,{acceptNode:n=>n.nodeName==='MAIN'||n.id==='acct'?NodeFilter.FILTER_REJECT:NodeFilter.FILTER_ACCEPT});
  for(let n=w.currentNode;n;n=w.nextNode()){
    if(n.nodeType===3){const o=ORIG.get(n)??n.nodeValue,k=o.trim();if(!k||!(k in EN))continue;ORIG.set(n,o);n.nodeValue=o.replace(k,tx(k));continue}
    if(n.nodeType!==1)continue;
    let o=ORIG.get(n);
    for(const a of ATTRS){const v=o?.[a]??n.getAttribute(a);if(v==null||!(v in EN))continue;(o||=(ORIG.set(n,{}),ORIG.get(n)))[a]=v;n.setAttribute(a,tx(v))}
  }
}
function applyLang(){
  LANG=S.settings.lang==='en'?'en':'ru';document.documentElement.lang=LANG;
  applyStatic();document.querySelectorAll('#langSeg button').forEach(b=>b.classList.toggle('on',b.dataset.l===LANG));
}
function setLang(l){S.settings.lang=l;applyLang();renderAccount();commit();movePill(false)}

// exercises: shown in English when a translation is known; English input is saved under the Russian name so history stays one
const EX_EN={
  'Жим штанги лёжа':'Barbell bench press','Жим лёжа':'Bench press','Жим гантелей лёжа':'Dumbbell bench press',
  'Жим штанги на наклонной':'Incline barbell bench press','Жим гантелей на наклонной':'Incline dumbbell press',
  'Жим штанги на наклонной скамье':'Incline barbell bench press','Жим гантелей на наклонной скамье':'Incline dumbbell press',
  'Жим лёжа узким хватом':'Close-grip bench press','Жим в тренажёре':'Machine chest press','Разведения гантелей':'Dumbbell flyes',
  'Разводка гантелей':'Dumbbell flyes','Сведение в кроссовере':'Cable crossover','Бабочка':'Pec deck','Отжимания':'Push-ups',
  'Отжимания на брусьях':'Dips','Приседания со штангой':'Barbell back squat','Приседания':'Squats','Фронтальные приседания':'Front squat',
  'Гоблет-приседания':'Goblet squat','Болгарские выпады':'Bulgarian split squat','Гакк-приседания':'Hack squat','Становая тяга':'Deadlift',
  'Румынская тяга':'Romanian deadlift','Сумо тяга':'Sumo deadlift','Выпады':'Lunges','Жим ногами':'Leg press',
  'Разгибания ног':'Leg extensions','Сгибания ног':'Leg curls','Сгибания ног лёжа':'Lying leg curls','Ягодичный мост':'Hip thrust',
  'Подъёмы на носки':'Calf raises','Подъёмы на носки стоя':'Standing calf raises','Гиперэкстензия':'Back extension',
  'Подтягивания':'Pull-ups','Тяга штанги в наклоне':'Bent-over barbell row','Тяга гантели в наклоне':'One-arm dumbbell row',
  'Тяга верхнего блока':'Lat pulldown','Тяга нижнего блока':'Seated cable row','Тяга горизонтального блока':'Seated cable row',
  'Тяга Т-грифа':'T-bar row','Пуловер':'Pullover','Шраги':'Shrugs','Жим стоя':'Overhead press','Армейский жим':'Military press',
  'Жим гантелей сидя':'Seated dumbbell press','Махи гантелями в стороны':'Lateral raises','Махи в стороны':'Lateral raises',
  'Махи в наклоне':'Rear delt raises','Тяга к подбородку':'Upright row','Тяга каната к лицу':'Face pull','Сгибания на бицепс':'Biceps curls',
  'Подъём штанги на бицепс':'Barbell curl','Сгибания с гантелями':'Dumbbell curls','Молотки':'Hammer curls','Скамья Скотта':'Preacher curl',
  'Французский жим':'Skull crushers','Разгибания на блоке':'Triceps pushdown','Разгибания рук на блоке':'Triceps pushdown',
  'Скручивания':'Crunches','Планка':'Plank','Подъёмы ног в висе':'Hanging leg raises','Бег':'Running','Ходьба':'Walking',
  'Беговая дорожка':'Treadmill','Велотренажёр':'Stationary bike','Эллипс':'Elliptical','Гребной тренажёр':'Rowing machine',
  'Скакалка':'Jump rope','Плавание':'Swimming',
};
const exK=n=>String(n||'').trim().toLowerCase().replace(/ё/g,'е');
const EX_ENk=new Map(Object.entries(EX_EN).map(([r,e])=>[exK(r),e])),EX_RUk=new Map(Object.entries(EX_EN).reverse().map(([r,e])=>[exK(e),r])); // first Russian name wins for a shared English one
// the exercise catalog (exercises.js), when present, is the source of names and aliases
const exCat=n=>typeof EX_ID!=='undefined'&&typeof exKey==='function'?EX_ID[exKey(n)]:null;
function exLabel(n){if(LANG!=='en')return n;return exCat(n)?.en||EX_ENk.get(exK(n))||exGuess(n)}
// names outside the catalog («Тяга верхнего блока широким хватом», «Жим гантелей сидя»): the closest catalog exercise
// contained in the name plus the remaining words, or the words one by one, e.g. «Lat pulldown (wide grip)», «Press (dumbbell seated)»
const EX_WORDS={
  'жим':'press','тяга':'row','приседания':'squat','присед':'squat','выпады':'lunges','выпад':'lunge','подтягивания':'pull-ups','отжимания':'push-ups',
  'сгибания':'curl','сгибание':'curl','разгибания':'extension','разгибание':'extension','разведения':'raise','разводка':'fly','махи':'raises','мах':'raise',
  'сведения':'fly','сведение':'fly','подъём':'raise','подъёмы':'raises','шраги':'shrugs','протяжка':'upright row','пуловер':'pullover','мост':'bridge',
  'становая':'deadlift','румынская':'Romanian','болгарские':'Bulgarian','французский':'French','фронтальные':'front','сумо':'sumo','гакк':'hack',
  'гиперэкстензия':'back extension','скручивания':'crunches','скручивание':'crunch','планка':'plank','вис':'hanging','висе':'hanging',
  'гантели':'dumbbell','гантелей':'dumbbell','гантелями':'dumbbells','гантелью':'dumbbell','штанга':'barbell','штанги':'barbell','штангой':'barbell',
  'гиря':'kettlebell','гири':'kettlebell','гирей':'kettlebell','блок':'cable','блока':'cable','блоке':'cable','кроссовер':'crossover','кроссовере':'crossover',
  'тренажёр':'machine','тренажёре':'machine','тренажёра':'machine','смит':'Smith','смита':'Smith','смите':'Smith','хаммер':'Hammer','хаммере':'Hammer',
  'канат':'rope','канатом':'rope','гриф':'bar','грифом':'bar','резинка':'band','резинкой':'band','турник':'bar','брусья':'dips','брусьях':'dips',
  'верхнего':'high','верхний':'high','нижнего':'low','нижний':'low','горизонтального':'horizontal','горизонтальная':'horizontal','вертикальная':'vertical',
  'грудь':'chest','груди':'chest','спина':'back','спины':'back','плечи':'shoulders','дельты':'delts','дельт':'delts','бицепс':'biceps','трицепс':'triceps',
  'ноги':'legs','ног':'leg','ногами':'legs','ногой':'leg','бедра':'thigh','бедро':'thigh','ягодицы':'glutes','ягодичный':'glute','икры':'calves','носки':'calf',
  'пресс':'abs','голову':'head','головы':'head','головой':'head','поясу':'waist','поясе':'waist','подбородку':'chin','лицу':'face','лоб':'forehead',
  'широким':'wide','широкий':'wide','узким':'close','узкий':'close','средним':'medium','хватом':'grip','хват':'grip','обратным':'reverse','обратный':'reverse',
  'обратные':'reverse','прямым':'straight','нейтральным':'neutral','параллельным':'parallel','одной':'one','одна':'one','рукой':'arm','рука':'arm','руки':'arms',
  'рук':'arms','сидя':'seated','стоя':'standing','лёжа':'lying','лежа':'lying','наклоне':'bent-over','наклонной':'incline','наклонная':'incline','наклон':'bent-over','гоблет':'goblet','ez':'EZ',
  'отрицательным':'decline','пауза':'pause','паузой':'pause','весом':'weighted','собственным':'bodyweight','стороны':'sides','сторону':'side',
  'боковая':'side','боковые':'side','задние':'rear','задней':'rear','передние':'front','колени':'knees','коленях':'knees','молот':'hammer','молотки':'hammer curls',
  'бег':'running','ходьба':'walking','дорожке':'treadmill','дорожка':'treadmill','велосипед':'bike','эллипс':'elliptical','скакалка':'jump rope','плавание':'swimming',
};
let EXW=null,EXF=null;const exGuessed=new Map(),exGuessRu=new Map(); // shown English label → the name it came from
function exGuess(n){
  if(typeof exNorm!=='function')return n;
  let r=exGuessed.get(n);if(r)return r;
  EXF||=new Map(Object.entries(EX_WORDS).map(([ru,en])=>[exNorm(ru),en]));EXW||=new Map([...EXF].reverse().map(([ru,en])=>[exStem(ru),en]));
  const words=exNorm(n.replace(/(\d)\s*[хx×]\s*(\d)/gi,'$1x$2')).split(' ').filter(w=>w&&!EX_STOP.has(w)),stems=words.map(exStem);
  let base=null,bt=[];
  for(const [sig,id] of EX_BY_SIG){const t=sig.split(' ');if(t.length>bt.length&&t.every(x=>stems.includes(x))){base=EX_ID[id].en;bt=t}}
  const rest=words.filter((w,i)=>!bt.includes(stems[i])&&!(base&&EX_FILLER.test(w))).map(w=>EXF.get(w)||EXW.get(exStem(w))||w);
  const out=[...new Set(rest)];
  if(!base){if(!out.length||out.every((w,i)=>/[а-я]/.test(w)))r=n;else{const [h,...m]=out;r=h[0].toUpperCase()+h.slice(1)+(m.length?' ('+m.join(' ')+')':'')}}
  else r=base+(out.length?' ('+out.join(' ')+')':'');
  exGuessed.set(n,r);if(r!==n&&!exGuessRu.has(exK(r)))exGuessRu.set(exK(r),n);return r;
}
function exCanon(n){if(!n)return n;const c=exCat(n);return exGuessRu.get(exK(n))||(c?.ru&&!/[а-яё]/i.test(n)?c.ru:EX_RUk.get(exK(n))||n)}

const EN={
  // navigation and header
  'Главная':'Home','Планер':'Planner','Зал':'Gym','Тело':'Body','Питание':'Food','Настройки':'Settings',
  'Предыдущий день':'Previous day','Следующий день':'Next day','Открыть календарь':'Open calendar','Сегодня':'Today',
  'Отдых':'Rest','Случайное исследование':'Random study','Исследования':'Research','Исследования о тренировках':'Training research',
  'Исследование дня':'Study of the day','Читать на PubMed ↗':'Read on PubMed ↗','Предыдущее':'Previous','Другое исследование':'Another study',
  'Закрыть':'Close','Календарь':'Calendar','Прошлый месяц':'Previous month','Следующий месяц':'Next month',
  'задачи выполнены':'tasks done','есть задачи':'has tasks','тренировка':'workout','Замеры':'Measurements','Замеры ·':'Measurements ·',
  'Утром натощак. Талия — по самому узкому месту.':'In the morning before eating. Waist at the narrowest point.',
  'Отмена':'Cancel','Сохранить':'Save','Вставить программу':'Paste program','Вставь программу':'Paste your program',
  'День 1 — Грудь\nЖим штанги лёжа 4x8\nРазводка гантелей 3x12\n\nДень 2 — Спина\nПодтягивания\nТяга штанги в наклоне':'Day 1 — Chest\nBarbell bench press 4x8\nDumbbell flyes 3x12\n\nDay 2 — Back\nPull-ups\nBent-over barbell row',
  'Заметки, Word, PDF или ячейки Excel вместе с заголовками.':'Notes, Word, PDF or Excel cells together with headers.',
  'Разобрать':'Import','Да':'Yes',
  // settings
  'Цели питания (в день)':'Nutrition goals (per day)','Ккал':'Kcal','Белки, г':'Protein, g','Жиры, г':'Fat, g','Углеводы, г':'Carbs, g',
  'Поддержка (TDEE), ккал':'Maintenance (TDEE), kcal','Вода, мл':'Water, ml','Тело и зал':'Body and gym','Целевой вес, кг':'Goal weight, kg',
  'Таймер отдыха, сек':'Rest timer, sec','Диапазон повторов':'Rep range','Аккаунт':'Account','Данные и бэкап':'Data and backup',
  'Экспорт JSON':'Export JSON','Импорт JSON':'Import JSON','Стереть всё':'Erase everything','Язык':'Language',
  // sync and account
  'Не удалось сохранить на устройстве: {0}. Сделайте экспорт в настройках.':'Could not save on this device: {0}. Export a backup in settings.',
  'Синхронизация…':'Syncing…','Синхронизация прервана — обновите страницу':'Sync interrupted, reload the page','☁︎ Синхронизировано':'☁︎ Synced',
  'Без синхронизации':'Not synced','Сохранение…':'Saving…','Ошибка сохранения':'Save failed',
  'Не удалось сохранить в облако ({0}). Данные остались на этом устройстве.':'Could not save to the cloud ({0}). Your data is still on this device.',
  'Офлайн':'Offline','Облако недоступно: {0}':'Cloud unavailable: {0}','Введи почту и пароль (минимум 6 символов)':'Enter your email and password (at least 6 characters)',
  'Мы отправили письмо — подтверди почту и затем войди':'We sent you an email. Confirm your address, then sign in','Готово, ты в аккаунте':'Done, you are signed in',
  'Неверная почта или пароль':'Wrong email or password','Ошибка: {0}':'Error: {0}','Выйти из аккаунта? Данные останутся на этом устройстве.':'Sign out? Your data stays on this device.',
  'Имя: 2–24 символа, буквы, цифры, точка, дефис':'Name: 2–24 characters, letters, digits, dot, hyphen','Профиль сохранён':'Profile saved','Это имя уже занято':'This name is taken',
  'Имя в рейтинге':'Leaderboard name','Показывать меня в таблице лидеров':'Show me on the leaderboard','Сохранить профиль':'Save profile','Выйти':'Sign out',
  'Синхронизация между устройствами и таблица лидеров.':'Sync between devices and a leaderboard.','Почта':'Email','Пароль':'Password',
  'Создать аккаунт':'Create account','Войти':'Sign in','У меня есть аккаунт':'I have an account',
  // leaderboard
  'Лидеры':'Leaderboard','Войти, чтобы участвовать':'Sign in to take part','Загружаю…':'Loading…','Упражнение':'Exercise',
  '1ПМ':'1RM','÷ вес':'÷ weight','Неделя':'Week','Свернуть':'Show less','Все {0}':'All {0}','Пока пусто':'Nothing yet',
  // charts
  'Нужно минимум 2 записи для графика.':'At least 2 entries are needed for a chart.','цель':'goal','из {0} ккал':'of {0} kcal',
  // planner
  'Год':'Year','Месяц':'Month','Задач нет.':'No tasks.','Выполнено':'Done','Удалить':'Delete','Удалить цель «{0}»?':'Delete the goal “{0}”?',
  'Целей пока нет.':'No goals yet.','Достигнута':'Achieved','Удалить привычку?':'Delete this habit?',
  'Прошлая неделя':'Previous week','Следующая неделя':'Next week','Открыть календарь месяца':'Open month calendar','{0} из {1} выполнено':'{0} of {1} done',
  'Новая задача…':'New task…','Без цели':'No goal','Добавить':'Add','Перенести незавершённые на завтра →':'Move unfinished to tomorrow →',
  'Заметки дня':'Day notes','#теги, мысли, самочувствие, [[ссылки на цели]]…':'#tags, thoughts, how you feel, [[links to goals]]…',
  'Привычки недели':'Habits this week','Например: сон 8 ч, шаги, креатин.':'For example: 8 h sleep, steps, creatine.','Новая привычка':'New habit',
  'Цели: Год → Месяц → Неделя':'Goals: Year → Month → Week','Цель':'Goal','Верхний уровень':'Top level',
  // home
  'Задачи на день':'Tasks today','Объём за неделю':'Weekly volume','кг':'kg','{0} к прошлой неделе':'{0} vs last week',
  'нет данных за прошлую неделю':'no data for last week','ккал':'kcal','Б':'P','Ж':'F','У':'C','Вес':'Weight','кг/нед':'kg/wk','нет замеров':'no entries',
  'Объём тренировок за неделю, кг':'Training volume this week, kg','Задачи':'Tasks','Привычки':'Habits',
  // gym
  'прошлый раз {0} повт. · сушка: удержать':'last time {0} reps · cut: hold','прошлый раз {0} повт. · +1 повтор':'last time {0} reps · +1 rep',
  '{0} во всех подходах · +{1} кг':'{0} on all sets · +{1} kg','{0} · сушка: чуть меньше вес, но в {1} повт.':'{0} · cut: a bit less weight, but {1} reps',
  '{0} · добери до {1} повт.':'{0} · work up to {1} reps','{0} · сушка: удержать':'{0} · cut: hold','{0} · +1 повтор до {1}':'{0} · +1 rep, up to {1}',
  '{0} · ниже формы, 90% лучшего 1ПМ ({1} кг)':'{0} · below form, 90% of best 1RM ({1} kg)','{0}% от 1ПМ {1} кг':'{0}% of 1RM {1} kg',
  '{0} повт. + {1} в запасе от 1ПМ {2} кг':'{0} reps + {1} in reserve from 1RM {2} kg','Удалить упражнение из тренировки?':'Remove this exercise from the workout?',
  'Отдых окончен':'Rest is over','Пора на следующий подход':'Time for the next set',
  'Сделать рабочим':'Make it a working set','Сделать разминочным':'Make it a warm-up set','Р':'W','повт':'reps','Повторы':'Reps',
  'Подход выполнен':'Set done','Разминка':'Warm-up','Рабочие':'Working','Рекорд':'Record','Группа мышц':'Muscle group','Программа':'Program',
  '{0} повт.':'{0} reps','{0} подх.':'{0} sets','Подставить':'Fill in','Сет':'Set','Прошлый':'Last','Вес, кг':'Weight, kg','Подход':'Set',
  'Убрать подход':'Remove set','Заметка':'Note','Заметка к упражнению':'Exercise note','Лучший 1ПМ: {0} кг':'Best 1RM: {0} kg',
  'Объём, кг':'Volume, kg','Подходов':'Sets','Рекорды':'Records','Последние тренировки':'Recent workouts','мин':'min',
  'Добавить упражнение':'Add exercise','Название упражнения':'Exercise name','Повторить прошлую тренировку':'Repeat last workout',
  // food
  'моё':'mine','база':'base','обычно {0} г':'usually {0} g','Убрать из моей базы':'Remove from my foods','Ищу в Open Food Facts…':'Searching Open Food Facts…',
  'Open Food Facts недоступен — показана только своя база.':'Open Food Facts is unavailable, showing only your own foods.',
  'Open Food Facts недоступен (нет сети) — показана только своя база.':'Open Food Facts is unavailable (offline), showing only your own foods.',
  'Ничего не нашлось. Введите КБЖУ вручную — продукт сохранится в вашу базу.':'Nothing found. Enter calories and macros by hand and the food is saved to your list.',
  'г':'g','г (100)':'g (100)','Убрать «{0}» из вашей базы продуктов?':'Remove “{0}” from your foods?','медленно':'slow','слишком быстро':'too fast','в норме':'on track',
  'Белки':'Protein','Жиры':'Fat','Углеводы':'Carbs','Профицит':'Surplus','Дефицит':'Deficit','Поддержку (TDEE) и цели задайте в ⚙︎':'Set maintenance (TDEE) and goals in ⚙︎',
  'Вода':'Water','мл':'ml','Продукты':'Foods','Используется «итог дня» — список ниже не учитывается.':'The day total is used, so the list below is not counted.',
  'Найти продукт или штрихкод':'Search food or barcode','Ещё раз':'Again','Пока пусто.':'Nothing yet.','Итог дня из FatSecret / MyFitnessPal':'Day total from FatSecret / MyFitnessPal',
  'Сохранить итог':'Save total','Убрать итог':'Remove total',
  // body
  'Вес тела':'Body weight','Цель: {0} кг':'Goal: {0} kg','Вес за {0}, кг':'Weight for {0}, kg','цель через ≈ {0} нед':'goal in ≈ {0} wk',
  'Шея':'Neck','Плечи':'Shoulders','Грудь':'Chest','Бицепс':'Biceps','Предплечье':'Forearm','Талия':'Waist','Ягодицы':'Glutes','Бедро':'Thigh','Голень':'Calf',
  'см':'cm','Записать замеры за {0}':'Log measurements for {0}','Сушка':'Cut','Набор':'Bulk','Поддержание':'Maintenance','к цели':'toward goal',
  'ожидаемо':'expected','против цели':'against goal','Замеры в динамике':'Measurements over time','{0} см с {1}':'{0} cm since {1}',
  'Прогресс всех замеров':'All measurements','Нужно 2 замера.':'2 entries are needed.','Силовые показатели':'Strength','Расчётный 1ПМ':'Estimated 1RM',
  '{0} кг с {1}':'{0} kg since {1}','Отметь подходы в «Зале».':'Tick off sets in the Gym tab.','Темп':'Pace','быстро':'fast','норма':'normal',
  'Талия / мышцы':'Waist / muscles','Сила':'Strength','держится':'holding','падает':'dropping','чуть ниже':'slightly lower',
  'Как идёт сушка':'How the cut is going','Нужно 2 замера и пара тренировок.':'2 measurements and a couple of workouts are needed.',
  'Есть признаки потери мышц':'Signs of muscle loss','Жир уходит, мышцы сохраняются':'Fat is going, muscle is kept','Пока всё в пределах нормы':'All within normal range so far',
  'Белок 1.6–2.2 г/кг · до 1% веса в неделю · тяжёлая база · сон 7–9 ч':'Protein 1.6–2.2 g/kg · up to 1% of weight per week · heavy compounds · 7–9 h sleep',
  'Замеры сохранены':'Measurements saved','Фигура с замерами тела':'Figure with body measurements',
  // program
  'День':'Day','День {0}':'Day {0}','нет связи с {0}':'no connection to {0}',
  'Старый формат .{0} не читается — пересохрани как .{0}x или PDF, или вставь текст':'The old .{0} format can’t be read. Save it as .{0}x or PDF, or paste the text',
  'Читаю «{0}»…':'Reading “{0}”…','Не удалось прочитать файл: {0}':'Could not read the file: {0}',
  'Не нашёл упражнений. Нужна колонка «Упражнение» или каждое упражнение на своей строке, дни — «День 1», «Понедельник:».':'No exercises found. Use an “Exercise” column or one exercise per line, with days like “Day 1” or “Monday:”.',
  'Моя программа':'My program','Найдено дней: {0}, упражнений: {1}':'Found days: {0}, exercises: {1}',', комментариев: {0}':', comments: {0}',', правил: {0}':', rules: {0}',
  '. Проверь и сохрани.':'. Check and save.','В программе нет ни одного упражнения':'The program has no exercises','Программа сохранена':'Program saved',
  'Удалить программу? Записанные тренировки останутся.':'Delete the program? Logged workouts stay.','Правила программы':'Program rules',
  'Без дня недели':'No weekday','Пн':'Mon','Вт':'Tue','Ср':'Wed','Чт':'Thu','Пт':'Fri','Сб':'Sat','Вс':'Sun',
  'Программа: проверь и сохрани':'Program: check and save','Название':'Name','Название дня':'Day name','Удалить день':'Delete day','Убрать':'Remove',
  'Комментарий к упражнению':'Exercise comment','Нет упражнений':'No exercises','+ Добавить упражнение и Enter':'+ Add exercise and press Enter',
  'Сохранить программу':'Save program','Excel, PDF, Word или текст.':'Excel, PDF, Word or text.','Загрузить файл':'Upload file','Вставить текст':'Paste text',
  'Изменить':'Edit','День программы на эту дату':'Program day for this date','Без программы':'No program','Начать тренировку: {0} упр.':'Start workout · {0}',
  'Всё добавлено':'All added','Сегодня без программы.':'No program today.',
  // muscle groups and cardio
  'Спина':'Back','Трицепс':'Triceps','Предплечья':'Forearms','Пресс':'Abs','Квадрицепс':'Quads','Бицепс бедра':'Hamstrings','Икры':'Calves',
  'Кардио':'Cardio','Другое':'Other','Минуты':'Minutes','Километры':'Kilometres','км':'km','Отрезок выполнен':'Segment done','Км':'Km',
  'Отрезок':'Segment','Убрать отрезок':'Remove segment','Итого':'Total','темп':'pace','мин/км':'min/km','км/ч':'km/h','Заметка: пульс, уклон':'Note: heart rate, incline',
  'Подходы за неделю':'Sets this week','Всего {0} · зелёная зона — норма':'Total {0} · green zone is the target',
  // research, calendar, data
  'Мета-анализ':'Meta-analysis','Обзор':'Review','РКИ':'RCT','Загрузка…':'Loading…','Нет связи — попробуйте позже':'No connection, try again later',
  'Бэкап сохранён':'Backup saved','Не удалось сохранить файл ({0})':'Could not save the file ({0})','файл не похож на бэкап Apex':'the file does not look like an Apex backup',
  'Заменить текущие данные данными из файла?':'Replace your current data with the data from this file?','Данные загружены':'Data loaded','Ошибка импорта: {0}':'Import error: {0}',
  'Стереть ВСЕ данные на всех устройствах? Это необратимо — сначала лучше сделать экспорт.':'Erase ALL data on all devices? This cannot be undone, so export a backup first.',
  // charts
  '3 мес':'3 mo','Всё':'All','Мин':'Min','Макс':'Max','Изменение':'Change','с {0}':'since {0}','{0} к {1}':'{0} vs {1}',
  'Нажмите на график — покажу дату и значение':'Tap the chart to see the date and value','График: от {0} до {1} {2}':'Chart: from {0} to {1} {2}',
  'За этот период меньше двух записей — выберите период длиннее.':'Fewer than two entries in this period. Pick a longer one.','До цели ≈ {0} нед':'Goal in ≈ {0} wk',
  // comments as points
  'ещё {0}':'{0} more','весь текст':'full text',
  // exercise names and merging
  'Объединить «{0}» с «{1}»? История, рекорды и цели станут общими. Разделить можно в любой момент.':'Merge “{0}” with “{1}”? History, records and targets will be shared. You can split them again at any time.',
  'Упражнения объединены':'Exercises merged','«{0}» — отдельное упражнение':'“{0}” is now a separate exercise','Вернул в общее упражнение':'Moved back into the shared exercise',
  'Упражнения и названия':'Exercises and names','{0} похожих':'{0} similar','Одно упражнение под разными названиями считается вместе: история, рекорды, цели.':'One exercise under different names is counted together: history, records, targets.',
  'Уже объединено автоматически: {0}.':'Already merged automatically: {0}.','Похоже на одно и то же':'Looks like the same exercise','и':'and','Объединить':'Merge',
  'Это разные упражнения':'These are different exercises','{0} трен.':'{0} workouts','в программе':'in program','Отделить в отдельное упражнение':'Split into a separate exercise',
  'Отделить':'Split','Вернуть в «{0}»':'Move back into “{0}”','Объединить с':'Merge with','Объединить с…':'Merge with…',
};
