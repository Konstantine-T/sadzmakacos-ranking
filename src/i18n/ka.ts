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
  },

  week: {
    current: "მიმდინარე კვირა",
    endsIn: "დარჩა",
    open: "ღია",
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
    votes: "ხმების მატრიცა",
    week: "კვირის მართვა",
    moderation: "მოდერაცია",
    results: "შედეგები",
    announcements: "განცხადებები",
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

    voter: "ვინ",
    target: "ვის",
    noVotes: "ამ კვირას ხმა არ მიუციათ.",

    endsAt: "დასრულების დრო",
    pauseVoting: "ხმის მიცემის შეჩერება",
    resumeVoting: "განახლება",
    forceClose: "კვირის დახურვა ახლავე",
    forceCloseWarning:
      "კვირა დაიხურება, შედეგები დაფიქსირდება და ახალი კვირა გაიხსნება. ეს შეუქცევადია.",

    deletePost: "პოსტის წაშლა",
    voidVote: "ხმის გაუქმება",

    editResult: "შედეგის შესწორება",
    edited: "შესწორებული",

    announcementBody: "განცხადების ტექსტი",
    publish: "გამოქვეყნება",
    hide: "დამალვა",
    show: "ჩვენება",

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
    avatarTooBig: "სურათი ძალიან დიდია (მაქს. 2MB).",
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
  if (message.includes("Failed to fetch") || message.includes("NetworkError")) {
    return ka.errors.offline;
  }
  return ka.errors.generic;
}
