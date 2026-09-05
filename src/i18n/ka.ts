/**
 * The single copy deck (§10). No hardcoded user-facing strings in components —
 * if you need a new one, it goes here first.
 *
 * Empty and error states get real direction, not apologies: an empty posts
 * section invites you to be first rather than shrugging.
 */

export const ka = {
  appName: "საძმაკაცოს რანკი",

  nav: {
    ranking: "რანკი",
    posts: "პოსტები",
    archive: "არქივი",
    profile: "პროფილი",
    allTime: "საერთო",
    admin: "ადმინი",
    trivia: "ტრივია",
    chat: "ჩატი",
    /** The wide layout has room to say where "back" goes. */
    backToRanking: "უკან რანკინგზე",
  },

  week: {
    current: "მიმდინარე კვირა",
    endsIn: "დარჩა",
    open: "ღია",
    openWeek: "ღია კვირა",
    closes: "კვირა იხურება",
    turnout: (v: number, t: number) => `${v}/${t} ხმა მიცემულია`,
    closed: "კვირა დასრულდა",
    paused: "ხმის მიცემა შეჩერებულია",
    label: "კვირა",
    number: (n: number) => `კვირა ${n}`,
    range: (a: string, b: string) => `${a} — ${b}`,
    days: "დღე",
    hours: "სთ",
    minutes: "წთ",
    seconds: "წმ",
    finished: "დასრულდა",
  },

  vote: {
    up: "ზემოთ",
    down: "ქვემოთ",
    clear: "ხმის გაუქმება",
    noSelf: "საკუთარ თავს ვერ აძლევ ხმას",
  },

  standings: {
    title: "რანკინგი",
    rank: "ადგილი",
    net: "ჯამი",
    up: "დადებითი",
    down: "უარყოფითი",
    total: "სულ ხმები",
    noVotes: "ხმა არ მიუღია",
    new: "ახალი",
    empty: "ჯერ არავის მიუღია ხმა. დაიწყე შენ.",
    you: "შენ",
    /** The hint beside the list title — one line, so it stays short here. */
    hint: "",
    /** Column headers — the wide layout has room for a real table. */
    colMember: "წევრი",
    colChange: "ცვლილება",
    colTemperature: "ტემპერატურა",
    colVote: "ხმა",
    /** The self-row note, trimmed to fit a 96px column. */
    noSelfShort: "საკუთარ თავს ვერ აძლევ",
    toneWarm: "თბილი კვირა",
    toneCold: "ცივი კვირა",
    toneDivisive: "გამყოფი კვირა",
  },

  posts: {
    title: "კვირის პოსტები",
    compose: "დაწერე შენი პოსტი",
    /** The collapsed composer — it says the irreversible part up front. */
    prompt: "დაწერე შენი პოსტი — რედაქტირება აღარ იქნება.",
    write: "დაწერე",
    oncePerWeek: "კვირაში ერთი",
    limit: (n: number) => `დარჩა ${n} სიმბოლო`,
    onceWarning:
      "პოსტს კვირაში ერთხელ წერ. გაგზავნის შემდეგ რედაქტირება და წაშლა აღარ შეიძლება.",
    confirm: "გაგზავნა",
    cancel: "გაუქმება",
    confirmTitle: "დარწმუნებული ხარ?",
    alreadyPosted: "ამ კვირის პოსტი უკვე დაწერე",
    empty: "ჯერ არავის დაუწერია. იყავი პირველი.",
    emptyArchive: "ამ კვირას პოსტები არ დაწერილა.",
    score: "ქულა",
  },

  polls: {
    title: "გამოკითხვა",
    /** Says out loud that this is NOT secret, unlike every other vote here. */
    signed: "პასუხები ღიაა — ყველა ხედავს ვინ რა აირჩია",
    pickOne: "აირჩიე ერთი",
    pickMany: "აირჩიე რამდენიც გინდა",
    closed: "დახურულია",
    answered: (n: number, t: number) => `${n}/${t} უპასუხა`,
    noAnswers: "ჯერ არავის უპასუხია",
    clear: "პასუხის გაუქმება",
  },

  auth: {
    signIn: "შესვლა Google-ით",
    signOut: "გასვლა",
    pendingTitle: "დაელოდე დადასტურებას",
    pendingBody: "ადმინი მალე დაგამატებს სიაში.",
    pendingHint: "როცა დაგამატებენ, გვერდი თავისით განახლდება.",
    signedInAs: (email: string) => `შესული ხარ როგორც ${email}`,
    loginTagline: "კვირის რანკინგი ჩვენთვის, ჩვენს შორის.",
    inactive: "შენი პროფილი გამორთულია.",
  },

  profile: {
    history: "რანკის ისტორია",
    badges: "ჯილდოები",
    /** Shared by the profile hero and the all-time detail — one wording only. */
    weeksAtOne: "კვირა #1-ზე",
    weeksPlayed: "ნათამაშები კვირა",
    breakdown: "კვირების ისტორია",
    noHistory: "ჯერ დახურული კვირა არ არის.",
    noBadges: "ჯილდოები ჯერ არ არის.",
    edit: "პროფილის რედაქტირება",
    nickname: "მეტსახელი",
    bio: "შენს შესახებ",
    avatar: "ავატარი",
    changeAvatar: "სურათის შეცვლა",
    saved: "შენახულია",
    bestRank: "საუკეთესო ადგილი",
    settings: "პარამეტრები",
    /** The rank-history bars show a fixed window, not the whole archive. */
    lastWeeks: (n: number) => `ბოლო ${n} კვირა`,
  },

  allTime: {
    title: "საერთო რანკი",
    avgNet: "საშუალო კვირაში",
    badgeWall: "ჯილდოების კედელი",
    empty: "ჯერ არცერთი კვირა არ დახურულა.",
    /** Short forms — these label a three-way sort control, not table headers. */
    sortTotal: "ჯამი",
    sortAvg: "საშუალო",
    sortCrowns: "#1",
  },

  archive: {
    title: "არქივი",
    recent: "ბოლო კვირები",
    pick: "აირჩიე კვირა",
    empty: "არქივი ცარიელია.",
    open: "მიმდინარე",
    closed: "დახურული",
  },

  badges: {
    weekly_king: "კვირის მეფე",
    crown_streak_3: "სამი კვირა ტახტზე",
    top_climber: "კვირის ამწევი",
    top_faller: "კვირის ჩამვარდნილი",
    most_hated: "კვირის ანტიგმირი",
    polarizing: "გამყოფი",
    ghost: "აჩრდილი",
    all_time_leader: "ლეგენდა",
  } as Record<string, string>,

  admin: {
    title: "ადმინი",
    dashboard: "მთავარი",
    accounts: "ანგარიშები",
    members: "წევრები",
    week: "კვირის მართვა",
    moderation: "მოდერაცია",
    results: "შედეგები",
    announcements: "განცხადებები",
    polls: "გამოკითხვა",
    audit: "ისტორია",

    pendingAccounts: "დასადასტურებელი ანგარიშები",
    noPending: "დასადასტურებელი ანგარიში არ არის.",
    linkTo: "დააკავშირე წევრთან",
    link: "დაკავშირება",
    reject: "უარყოფა",
    unlink: "გათიშვა",

    createMember: "ახალი წევრი",
    nickname: "მეტსახელი",
    bio: "ბიო",
    active: "აქტიური",
    inactive: "გამორთული",
    deactivate: "გამორთვა",
    activate: "ჩართვა",
    linked: "დაკავშირებული",
    notLinked: "არ არის დაკავშირებული",

    endsAt: "დასრულების დრო",
    pauseVoting: "ხმის მიცემის შეჩერება",
    resumeVoting: "განახლება",
    forceClose: "კვირის დახურვა ახლავე",
    forceCloseWarning:
      "კვირა დაიხურება, შედეგები დაფიქსირდება და ახალი კვირა გაიხსნება. ეს შეუქცევადია.",

    deletePost: "პოსტის წაშლა",

    editResult: "შედეგის შესწორება",
    edited: "შესწორებული",

    announcementBody: "განცხადების ტექსტი",
    publish: "გამოქვეყნება",
    hide: "დამალვა",
    show: "ჩვენება",

    pollQuestion: "კითხვა",
    pollOptions: "პასუხები — თითო ხაზზე ერთი",
    pollMulti: "რამდენიმე პასუხის არჩევა შეიძლება",
    pollCreate: "გამოკითხვის შექმნა",
    pollClose: "დახურვა",
    pollReopen: "ხელახლა გახსნა",
    pollDelete: "გამოკითხვის წაშლა",
    pollNone: "გამოკითხვა ჯერ არ შეგიქმნია.",
    pollOptionsHint: "მინიმუმ 2, მაქსიმუმ 10",
    /** Options cannot change once answers exist — same one-shot rule as posts. */
    pollOnceWarning: "შექმნის შემდეგ პასუხების შეცვლა აღარ შეიძლება.",

    actor: "ვინ",
    action: "რა",
    when: "როდის",

    stats: {
      turnout: "აქტიურობა",
      votesCast: "მიცემული ხმები",
      posts: "პოსტები",
      pending: "დასადასტურებელი",
      unlinked: "დაუკავშირებელი წევრი",
      timeLeft: "დარჩენილი დრო",
    },
  },

  /**
   * Notifications.
   *
   * Nicknames are NEVER inflected. The ergative "-მ" that "გიორგიმ დაწერა"
   * needs is not uniform across nicknames, so every line that carries a name
   * sets it off with a dash instead: "ახალი პოსტი — გიორგი".
   *
   * Reactions and votes say "ვიღაცამ" and never a name. That is rule 1, and
   * the database backs it up — a reaction row physically cannot store who
   * reacted, so there is no name here to reach for even by mistake.
   */
  notifications: {
    title: "შეტყობინებები",
    open: "შეტყობინებები",
    empty: "ჯერ არაფერი მომხდარა",
    newPost: (nickname: string) => `ახალი პოსტი — ${nickname}`,
    rankMoved: (from: number, to: number) => `ახლა #${to} ხარ (იყავი #${from})`,
    rankFirst: (to: number) => `ახლა #${to} ხარ`,
    reactionOne: (emoji: string) => `ვიღაცამ ${emoji} დაარეაქცია`,
    reactionMany: (n: number) => `${n} ახალი რეაქცია`,
    postReactionOne: (emoji: string) =>
      `ვიღაცამ ${emoji} დაარეაქცია შენს პოსტს`,
    postReactionMany: (n: number) => `შენს პოსტს ${n} რეაქცია`,
    postVoteOne: "ვიღაცამ ხმა მისცა შენს პოსტს",
    postVoteMany: (n: number) => `შენს პოსტს ${n} ხმა`,
  },

  chat: {
    title: "ჩატი",
    placeholder: "დაწერე რამე…",
    send: "გაგზავნა",
    empty: "ჯერ არავის უთქვამს არაფერი",
    deleted: "შეტყობინება წაშლილია",
    today: "დღეს",
    yesterday: "გუშინ",
    typingOne: (name: string) => `${name} წერს…`,
    typingTwo: (a: string, b: string) => `${a} და ${b} წერენ…`,
    typingMany: (n: number) => `${n} ადამიანი წერს…`,
    newMessages: "ახალი შეტყობინებები",
    tooLong: "შეტყობინება ძალიან გრძელია",
    delete: "წაშლა",
  },

  flags: {
    name: "გამოიცანი ქვეყანა დროშის მიხედვით",
    short: "დროშები",
    subtitle: "რამდენს გამოიცნობ ზედიზედ?",
    start: "თამაშის დაწყება",
    again: "თავიდან",
    board: "საუკეთესო შედეგები",
    empty: "ჯერ არავის უთამაშია",
    streak: "ზედიზედ",
    best: "რეკორდი",
    plays: (n: number) => `${n} თამაში`,
    over: "თამაში დასრულდა",
    correctWas: (name: string) => `სწორი პასუხი: ${name}`,
    perfect: (n: number) => `ყველა ${n} დროშა გამოიცანი!`,
    close: "დახურვა",
  },

  trivia: {
    title: "ტრივია",
    games: "თამაშები",
    rank: "ტრივიას რანკი",
    thisWeek: "ეს კვირა",
    allTime: "საერთო",

    skills: {
      name: "უნარების ტესტები",
      subtitle: "კვირის ტესტი",
      start: "დაწყება",
      resume: "გაგრძელება",
      done: "დასრულებულია",
      progress: (answered: number, total: number) =>
        `${answered}/${total} პასუხი`,
    },

    confirm: "დადასტურება",
    next: "შემდეგი",
    finish: "დასრულება",
    counter: (n: number, total: number) => `${n} / ${total}`,

    finished: {
      title: "ტესტი დასრულებულია",
      score: (correct: number, total: number) =>
        `${correct} სწორი ${total}-დან`,
      back: "ტრივიაზე დაბრუნება",
    },

    board: {
      empty: "ჯერ არავის უთამაშია",
    },

    home: {
      title: "ტრივიას ტოპ 5",
      all: "სრული რანკი",
    },

    profile: {
      title: "ტრივია",
      totalCorrect: "სწორი პასუხი",
      testsTaken: "ტესტი",
      bestWeek: "საუკეთესო კვირა",
      rank: "ადგილი",
      empty: "ჯერ არ უთამაშია",
    },

    errors: {
      noTest: "ამ კვირას ტესტი არ არის",
      alreadyAnswered: "პასუხი უკვე გაცემულია",
      weekClosed: "კვირა დაიხურა",
    },
  },

  common: {
    loading: "იტვირთება…",
    save: "შენახვა",
    cancel: "გაუქმება",
    confirm: "დადასტურება",
    delete: "წაშლა",
    close: "დახურვა",
    back: "უკან",
    yes: "დიახ",
    no: "არა",
    search: "ძებნა",
    theme: "თემა",
    themeDark: "ბნელი",
    themeLight: "ნათელი",
    retry: "თავიდან ცდა",
  },

  errors: {
    generic: "რაღაც ვერ გამოვიდა. სცადე თავიდან.",
    offline: "კავშირი გაწყდა.",
    notFound: "ასეთი გვერდი არ არსებობს.",
    noOpenWeek: "ღია კვირა არ არის.",
    weekPaused: "ხმის მიცემა დროებით შეჩერებულია.",
    alreadyPosted: "ამ კვირის პოსტი უკვე დაწერე.",
    noSelfVote: "საკუთარ თავს ვერ აძლევ ხმას.",
    forbidden: "ამის უფლება არ გაქვს.",
    tooLong: "ტექსტი ძალიან გრძელია.",
    empty: "ცარიელია.",
    /*
      The size the member is told about is the size of the file they PICK, not
      the size of what gets stored — the square that goes to storage is ~40KB
      whatever they pick. The old copy said 2MB, and it was enforced against the
      original photo, so a normal phone camera shot was refused outright.
    */
    avatarTooBig: "სურათი ძალიან დიდია (მაქს. 32MB).",
    avatarWrongType: "ეს ფაილი სურათი არ არის.",
    avatarUndecodable: "ამ სურათს ვერ ვხსნი. სცადე JPG ან PNG.",
    pollClosed: "გამოკითხვა დახურულია.",
    pollSingleChoice: "აქ მხოლოდ ერთი პასუხის არჩევა შეიძლება.",
    pollTooFewOptions: "მინიმუმ ორი პასუხი უნდა იყოს.",
    pollTooManyOptions: "მაქსიმუმ ათი პასუხი შეიძლება.",
  },
} as const;

/** Maps a Postgres error message onto a Georgian sentence. */
export function errorToKa(message: string | undefined): string {
  if (!message) return ka.errors.generic;
  if (message.includes("no_self_vote")) return ka.errors.noSelfVote;
  if (message.includes("already_posted")) return ka.errors.alreadyPosted;
  if (message.includes("week_paused")) return ka.errors.weekPaused;
  if (message.includes("no_open_week")) return ka.errors.noOpenWeek;
  if (message.includes("forbidden") || message.includes("not_a_member"))
    return ka.errors.forbidden;
  if (message.includes("empty_body")) return ka.errors.empty;
  if (message.includes("poll_closed")) return ka.errors.pollClosed;
  if (message.includes("single_choice_only")) return ka.errors.pollSingleChoice;
  if (message.includes("too_few_options")) return ka.errors.pollTooFewOptions;
  if (message.includes("too_many_options")) return ka.errors.pollTooManyOptions;
  if (message.includes("too_long")) return ka.chat.tooLong;
  if (message.includes("week_closed")) return ka.trivia.errors.weekClosed;
  // A repeat answer trips the (question_id, member_id) primary key rather than
  // a named guard, so it's matched on the constraint name — the generic
  // "duplicate key" text would also catch unrelated constraint violations
  // elsewhere in the app and mislabel them as an already-answered question.
  if (message.includes("trivia_answers_pkey"))
    return ka.trivia.errors.alreadyAnswered;
  /*
    no_such_question and bad_choice are raised by answer_trivia() too, but are
    left unmapped on purpose. The client only ever sends a question id it just
    rendered and a choice index within that question's own options array, so
    either one reaching here means a bug, not something a member did — a
    Georgian string for it would dress the bug up as an expected outcome.
  */
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return ka.errors.offline;
  }
  return ka.errors.generic;
}
