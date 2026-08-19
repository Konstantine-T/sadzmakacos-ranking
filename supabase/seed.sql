-- ============================================================================
-- seed.sql — DEV ONLY
--
-- Builds 20 members, six closed weeks and one open week. The six weeks are
-- closed by actually calling close_current_week(), so this file doubles as a
-- test of the close job and of the badge logic — no badge row is ever inserted
-- by hand.
--
-- The last closed week is rigged to contain the three cases that are easy to
-- get wrong and impossible to eyeball otherwise:
--   * a TIE at #1        → competition ranking must produce 1, 1, 3
--   * a member on 0/0    → the ghost badge and the bare HeatBar axis
--   * a member on +7/-7  → net 0 but loud; must outrank a quiet 0/0
--
-- SAFETY: refuses to run once any real Google account has been linked.
-- ============================================================================

do $seed$
declare
  v_names text[] := array[
    'გიო','ლაშა','ნიკა','სანდრო','დათო','ბექა','გიორგი','ლევანი','ზურა','თორნიკე',
    'ირაკლი','კახა','მიშა','ოთარი','პაატა','რატი','საბა','ტატო','უჩა','ვასო'
  ];
  v_bios text[] := array[
    'ცხოვრება მოკლეა, ხმა მიეცი გულით.',
    'ყოველთვის გვიან მოვდივარ.',
    'არაფერს ვამბობ, მაგრამ ყველაფერი ვიცი.',
    'ერთხელ ვიყავი პირველი. მახსოვს.',
    'პასუხისმგებელი ვარ ჯგუფურ ჩატზე.',
    null,'შაბათს არ მელაპარაკოთ.',null,
    'ნაკლებად ვსაუბრობ, მეტს ვაკეთებ.','მე ვარ ის, ვინც ყოველთვის იხდის.',
    null,'დილის ხუთ საათზე ვწერ.','მუდამ მშიერი.',null,
    'ჩემი ხმა ძვირია.','კარგი ადამიანი ვარ, ალბათ.',null,
    'არ მაინტერესებს რანკი. (მაინტერესებს.)','ბოლო ადგილიც ადგილია.','დუმილი ოქროა.'
  ];
  v_posts text[] := array[
    'ამ კვირას ყველას ხმას ვაძლევ. თითქმის ყველას.',
    'ვინც ჩემზე მინუსი დადო, ვიცი ვინც ხარ.',
    'შაბათს ვიკრიბებით. ვინც არ მოვა, მინუსი.',
    'რანკი ცხოვრება არაა. მაგრამ დღეს არის.',
    'პირველი ადგილი მიყვარს. მეორეც.',
    'ამ კვირას არაფერი მაქვს სათქმელი. მაინც ვწერ.',
    'გამარჯვება არაფერს ნიშნავს თუ ვასომ არ ნახა.',
    'ვისაც ჩემი პოსტი მოეწონა, ხვალ ყავა ჩემზეა.',
    'ბოლო ადგილზე ვარ და მშვიდად მძინავს.',
    'ხმის მიცემა ხელოვნებაა, არა ომი.',
    'დღეს კარგი დღეა. ხვალ ვნახოთ.',
    'ერთი კვირა კიდევ და ტახტი ჩემია.'
  ];
  v_ids       uuid[];
  v_member_id uuid;
  v_week    int;
  v_start   timestamptz;
  v_cand    int[];
  v_up      int;
  v_down    int;
  v_off     int;
  wk        int;
  t         int;
  j         int;
  v_post_id uuid;
  v_pv      int;
  v_emojis  text[] := array['🔥','😂','💀','👑','😭','💩','🖕','🫂'];
begin
  if exists (select 1 from public.members where auth_user_id is not null) then
    raise exception 'seed.sql refuses to run: real Google accounts are already linked to members';
  end if;

  -- ------------------------------------------------------------- wipe ----
  delete from public.member_badges;
  delete from public.weekly_results;
  delete from public.post_reactions;
  delete from public.member_reactions;
  delete from public.post_votes;
  delete from public.posts;
  delete from public.votes;
  delete from public.announcements;
  delete from public.weeks;
  delete from public.members;
  delete from public.vote_events;
  delete from public.score_events;
  delete from public.audit_log;

  -- ---------------------------------------------------------- members ----
  -- Capture the ids in INSERTION order. Collecting them afterwards with
  -- `order by created_at` does not work: created_at defaults to now(), which
  -- is the transaction timestamp and therefore identical for all 20 rows, so
  -- the ordering would silently fall back to nickname and the rigged vote
  -- profiles below would land on the wrong people.
  for j in 1..20 loop
    insert into public.members (nickname, bio)
    values (v_names[j], v_bios[j])
    returning id into v_member_id;
    v_ids[j] := v_member_id;
  end loop;

  -- ------------------------------------------------------------ weeks ----
  -- Six closed weeks ending exactly at the current Monday, then one open week
  -- covering the present.
  v_start := (date_trunc('week', (now() at time zone 'Asia/Tbilisi'))
              - interval '6 weeks') at time zone 'Asia/Tbilisi';

  insert into public.weeks (starts_at, ends_at, status)
  values (v_start, v_start + interval '7 days', 'open');

  for wk in 1..6 loop
    v_week := public.open_week_id();

    -- ---- votes ----
    for t in 1..20 loop
      -- A rough popularity curve that drifts week to week, so ranks move.
      v_up   := greatest(0, 13 - t + ((wk * ((t % 5) + 1)) % 7));
      v_down := ((t * 3 + wk * 2) % 9);

      -- ---- rigging, so the seed exercises the logic that is easy to get
      -- ---- wrong and impossible to eyeball.

      -- Member 1 holds the throne for the last three weeks running, which is
      -- the only way crown_streak_3 ever fires. Everyone else is capped below
      -- them so the streak is unambiguous.
      if wk >= 4 then
        if t = 1 then
          v_up := 15; v_down := 0;
        elsif wk < 6 then
          v_up := least(v_up, 10);
        end if;
      end if;

      if wk = 6 then
        if t = 20 then
          v_up := 0; v_down := 0;                    -- აჩრდილი: nobody thought about you
        elsif t = 19 then
          v_up := 7; v_down := 7;                    -- გამყოფი: net 0 but loud
        elsif t = 2 then
          v_up := 15; v_down := 0;                   -- ties member 1 at #1 → 1, 1, 3
        elsif t <> 1 then
          v_up := least(v_up, 9); v_down := least(v_down, 6);
        end if;
      elsif wk = 3 and t in (4, 5) then
        v_up := 11; v_down := 3;                     -- an earlier tie, for movement
      end if;

      if v_up + v_down > 19 then
        v_down := greatest(0, 19 - v_up);
      end if;
      continue when v_up + v_down = 0;

      v_off := wk * 7 + t * 3;
      select array_agg(i order by ((i + v_off) % 20), i) into v_cand
        from generate_series(1, 20) i where i <> t;

      for j in 1..v_up loop
        insert into public.votes (week_id, voter_id, target_id, value)
        values (v_week, v_ids[v_cand[j]], v_ids[t], 1)
        on conflict do nothing;
      end loop;
      for j in v_up + 1 .. v_up + v_down loop
        insert into public.votes (week_id, voter_id, target_id, value)
        values (v_week, v_ids[v_cand[j]], v_ids[t], -1)
        on conflict do nothing;
      end loop;
    end loop;

    -- ---- posts, post votes, post reactions ----
    for j in 1..10 loop
      t := ((wk * 3 + j * 2) % 20) + 1;
      insert into public.posts (week_id, author_id, body)
      values (v_week, v_ids[t], v_posts[((wk + j) % 12) + 1])
      on conflict (week_id, author_id) do nothing
      returning id into v_post_id;

      if v_post_id is null then
        continue;
      end if;

      v_pv := ((wk * j) % 11) + 2;                   -- 2..12 voters
      for t in 1..v_pv loop
        insert into public.post_votes (post_id, voter_id, value)
        values (v_post_id, v_ids[((wk + j + t) % 20) + 1],
                case when (t + j) % 4 = 0 then -1 else 1 end)
        on conflict do nothing;
      end loop;

      for t in 1..((j % 3) + 1) loop
        insert into public.post_reactions (post_id, reactor_id, emoji)
        values (v_post_id, v_ids[((wk * 2 + j + t) % 20) + 1],
                v_emojis[((j + t) % array_length(v_emojis, 1)) + 1])
        on conflict do nothing;
      end loop;

      v_post_id := null;
    end loop;

    -- ---- member reactions ----
    for t in 1..20 loop
      for j in 1..((t + wk) % 4) loop
        insert into public.member_reactions (week_id, member_id, reactor_id, emoji)
        values (v_week, v_ids[t], v_ids[((t + wk * 3 + j * 5) % 20) + 1],
                v_emojis[((t + j) % array_length(v_emojis, 1)) + 1])
        on conflict do nothing;
      end loop;
    end loop;

    -- ---- close it, which also opens the next one ----
    perform public.close_current_week(true);
  end loop;

  -- ------------------------------------------------- the open week now ----
  v_week := public.open_week_id();

  -- A handful of live votes so the board isn't empty on first load.
  for t in 1..20 loop
    v_up   := greatest(0, 6 - (t % 7));
    v_down := (t % 4);
    continue when v_up + v_down = 0;

    v_off := t * 5;
    select array_agg(i order by ((i + v_off) % 20), i) into v_cand
      from generate_series(1, 20) i where i <> t;

    for j in 1..v_up loop
      insert into public.votes (week_id, voter_id, target_id, value)
      values (v_week, v_ids[v_cand[j]], v_ids[t], 1) on conflict do nothing;
    end loop;
    for j in v_up + 1 .. v_up + v_down loop
      insert into public.votes (week_id, voter_id, target_id, value)
      values (v_week, v_ids[v_cand[j]], v_ids[t], -1) on conflict do nothing;
    end loop;
  end loop;

  for j in 1..6 loop
    insert into public.posts (week_id, author_id, body)
    values (v_week, v_ids[j * 3], v_posts[j])
    on conflict (week_id, author_id) do nothing
    returning id into v_post_id;
    if v_post_id is null then continue; end if;

    for t in 1..(j + 2) loop
      insert into public.post_votes (post_id, voter_id, value)
      values (v_post_id, v_ids[((j * 2 + t) % 20) + 1],
              case when t % 5 = 0 then -1 else 1 end)
      on conflict do nothing;
    end loop;
    v_post_id := null;
  end loop;

  insert into public.announcements (body)
  values ('პირველი კვირა გრძელია — ორშაბათს, 24 აგვისტოს იხურება.');

  raise notice 'seed complete: % members, % weeks, open week %',
    (select count(*) from public.members),
    (select count(*) from public.weeks),
    v_week;
end
$seed$;
