/*
 * A card and a row can say the start of a task's description under its
 * title.
 *
 * `excerpt_of(body)`: the body's nodes in the order they are written,
 * walking only `content` — an attribute that holds nodes, a task chip's
 * `line`, is not words on the page. Text is its text; a person named is
 * `@Name`; a task chip is its handle and title; a document chip is its
 * title (already veiled on the way in where the project may not see it,
 * `veilDocrefs`). Any other node — a paragraph's edge, a line break, a
 * picture — is a space. Spaces are folded, named rather than `\s`, whose
 * reach depends on the database's locale; past 160 characters it is cut to
 * 159 and an ellipsis; nothing to say is null. Sixty-four levels deep at
 * most. `shared-schema/src/excerpt.ts` is the same rule for a screen
 * drawing what it has just saved, held to this one by
 * `server/test/excerpt.test.ts`.
 *
 * `task.excerpt`: stored, worked out by the database whenever a body is
 * written, as `said` is (migration 098) — so the import, the chat, the
 * board's page, a repeat and a copy all keep it without one of them having
 * to remember, and the list reads a column rather than every body on the
 * page. Measured before choosing, on ten thousand descriptions: worked out
 * at read time (a recursive query over the body) a page of five hundred
 * cost 58 ms of one-paragraph descriptions and 450 ms of thirty-paragraph
 * ones, on every read of every list. So it is stored, and walked the
 * cheaper way: level by level, stopping as soon as there are 160
 * characters — 0.06 ms a save for one paragraph and 0.23 for thirty, what
 * `words_of` already costs the same save. A megabyte of empty paragraphs,
 * the most a description may weigh, is 0.7 s; walked by path from the top
 * it was 35, because every step unpacked the whole body again.
 *
 * Named with their schema inside and out: a restore fills a stored column
 * with an empty search path, and an unqualified call would end it.
 *
 * Adding a stored column writes every task again, once — about a second
 * for ten thousand. No row trigger fires on that, so no `updated_at` moves.
 */

/* What one node says on its own. */
create function excerpt_piece(n jsonb) returns text
  language sql immutable parallel safe
  as $$
    select case n ->> 'type'
      when 'text' then coalesce(n ->> 'text', '')
      when 'mention' then '@' || coalesce(n -> 'attrs' ->> 'label', '')
      when 'taskref' then concat_ws(' ',
        case when n -> 'attrs' ->> 'number' is not null
             then coalesce(nullif(n -> 'attrs' ->> 'key', '') || '-', '#') || (n -> 'attrs' ->> 'number') end,
        n -> 'attrs' ->> 'title')
      when 'docref' then coalesce(n -> 'attrs' ->> 'title', '')
      else ' '
    end
  $$;

/* A node and what is under it, after what was said before it; it stops
   once there is more than an excerpt holds, and so does everything above. */
create function excerpt_walk(n jsonb, depth int, said text) returns text
  language plpgsql immutable parallel safe
  as $$
  declare
    k jsonb;
  begin
    said := said || public.excerpt_piece(n);
    if depth >= 64 or jsonb_typeof(n -> 'content') is distinct from 'array' then
      return said;
    end if;
    for k in select value from jsonb_array_elements(n -> 'content') loop
      said := public.excerpt_walk(k, depth + 1, said);
      if char_length(said) > 160 then
        said := regexp_replace(said, '[ \t\n\r\f\v ]+', ' ', 'g');
        if char_length(ltrim(said, ' ')) > 161 then
          return said;
        end if;
      end if;
    end loop;
    return said;
  end
  $$;

create function excerpt_of(body jsonb) returns text
  language plpgsql immutable parallel safe
  as $$
  declare
    said text;
  begin
    if body is null or jsonb_typeof(body) <> 'object' then
      return null;
    end if;
    said := btrim(regexp_replace(public.excerpt_walk(body, 0, ''), '[ \t\n\r\f\v ]+', ' ', 'g'), ' ');
    return case when char_length(said) > 160 then rtrim(left(said, 159), ' ') || '…' else nullif(said, '') end;
  end
  $$;

/* Worked out as whoever writes the row — the application, and the worker
   that makes the next of a series and clears out — so theirs to call
   (migration 227: a new function is nobody's until it is granted). */
grant execute on function excerpt_piece(jsonb), excerpt_walk(jsonb, int, text), excerpt_of(jsonb)
  to tracker_app, tracker_worker;

alter table task add column excerpt text generated always as (public.excerpt_of(body)) stored;
