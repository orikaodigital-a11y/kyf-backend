create table if not exists legal_pages (
  key text primary key,
  title text not null,
  body text not null,
  updated_at timestamptz default now()
);

insert into legal_pages (key, title, body) values
  ('privacy', 'Privacy Policy', 'Know Your Faculty collects the information you provide when creating your profile (name, institutional email, university, research interests) and information generated through your use of the app (matches, messages, posts). We use this to operate the networking, matching, and communication features of the app. We do not sell your personal data to third parties. Location data is only collected and shared with other professors when you explicitly enable location sharing, and it is never shown as an exact address - only as an approximate distance. You may request access to, correction of, or deletion of your data by contacting us through the Contact Us page. This policy may be updated from time to time; continued use of the app after changes constitutes acceptance of the updated policy.'),
  ('terms', 'Terms & Conditions', 'By creating an account on Know Your Faculty, you confirm that you are a genuine academic or research professional and that the information on your profile is accurate. You agree not to use the platform to harass, impersonate, or misrepresent yourself to other users. Paid features (Priority Connect, Opportunity Postings, Featured Profile, Post Boost) are billed as described at the time of purchase. We reserve the right to suspend or terminate accounts that violate these terms, including fake profiles, spam, or abusive behavior toward other professors. Continued use of the app constitutes acceptance of these terms.'),
  ('refund', 'Refund & Cancellation Policy', 'One-time paid features (Priority Connect, Opportunity Postings, Post Boosts) are non-refundable once the action has been completed. If a payment was charged but the associated action failed to complete due to a technical error, contact us through Help & Support with your payment details and we will investigate and issue a refund where appropriate. The Featured Profile subscription can be cancelled at any time from your Profile page; cancellation stops future renewals but does not refund the current billing period.'),
  ('disclaimer', 'Disclaimer', 'Know Your Faculty is a networking platform that helps professors and researchers discover and connect with one another. We do not verify the accuracy of publications, credentials, or claims made by users beyond the institutional email verification process, and we are not responsible for the outcome of any collaboration, agreement, or communication between users. Verified badges indicate a confirmed institutional email address only, not an endorsement of a professor''s work or character.'),
  ('contact', 'Contact Us & Grievance Officer', 'For questions, feedback, or complaints about content or conduct on Know Your Faculty, please use the Help & Support option in the app. For formal grievances, you may contact our designated Grievance Officer as required under applicable law. Response times for grievances are typically within a few business days.')
on conflict (key) do nothing;

create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now()
);

insert into app_settings (key, value) values
  ('help_categories', '["Payment or billing issue","Profile or photo upload issue","Matching / connection bug","Account or login issue","Content or feed issue","Something else"]'),
  ('announcement_banner', '{"active": false, "text": ""}')
on conflict (key) do nothing;

create table if not exists collab_score_weights (
  id smallint primary key default 1,
  base int not null,
  category_match int not null,
  per_tag_overlap int not null,
  max_tag_bonus int not null,
  per_goal_overlap int not null,
  max_goal_bonus int not null,
  cap int not null,
  updated_at timestamptz default now(),
  constraint single_row check (id = 1)
);

insert into collab_score_weights (id, base, category_match, per_tag_overlap, max_tag_bonus, per_goal_overlap, max_goal_bonus, cap)
values (1, 35, 25, 12, 36, 8, 16, 98)
on conflict (id) do nothing;
