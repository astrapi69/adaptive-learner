# Privacy policy

> This page is a translation of the German original and is provided for
> information only. Only the German version is legally binding.

Last updated: 20 October 2026

This policy covers the public web version of Adaptive Learner at
`astrapi69.github.io/adaptive-learner`, the public preview of the next version
at `astrapi69.github.io/adaptive-learner-content-test` and these documentation
pages. If you install Adaptive Learner yourself (desktop launcher or Docker),
the app runs on your own device and the operator of these pages then receives
only what you send him yourself, such as a shared lesson or an error report.
Even then the app and the launcher ask `api.github.com` for new
versions, learning content comes from GitHub, and your own server sends AI
requests to the provider you chose.

## Controller

Asterios Raptis, Seestraße 68, 71638 Ludwigsburg, Germany

Email: asterios.raptis@web.de

## The short version

Adaptive Learner has no server of its own. The app and these pages set no
cookies, use no analytics or tracking services and load no fonts or scripts
from third parties. Your learning progress, statistics and settings stay in
your browser, for you. The operator receives only what you send him yourself,
and others receive parts of them only when a feature you use needs them, such
as the AI with your own key.

Data leaves your device only in these cases, each described in detail below:

- When you open the app and these pages, GitHub as the hosting provider
  processes your IP address.
- The app loads learning content from GitHub and also checks there on its own
  whether anything is new.
- When you share a lesson with the community or use GitHub features with your
  own access token, the data goes to GitHub; the operator receives shared
  contributions as well.
- GitHub receives an error report only when you open it on GitHub yourself.
- AI features send your requests with your own key directly to the provider
  you chose.
- For voice input and read-aloud, your browser may use an online service,
  depending on its maker.
- Share buttons and external links open other sites only after you click.
- You email the operator.

## Hosting on GitHub Pages

The app, the preview and this documentation are served by GitHub Pages, a
service of GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA
94107, USA. On every request GitHub processes your device's IP address and the
usual connection data (time, requested file, browser type); according to
GitHub, it logs and stores the IP address for security purposes. The operator
does not receive this data.

The legal basis is the legitimate interest in secure and performant delivery
(Art. 6 (1) (f) GDPR). GitHub is certified under the EU-US Data Privacy
Framework, so an adequacy decision covers the transfer to the USA (Art. 45
GDPR). More information:
[GitHub Privacy Statement](https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement).

Beyond that, these documentation pages load nothing from other servers: they
use your system's fonts, and the search runs in your browser without your
search terms leaving it.

## Loading lesson content

Learning content lives in content repositories on GitHub. Your browser loads
it directly from `raw.githubusercontent.com`, and repositories with their own
access token through `api.github.com`. The recipient, itself a controller, is
GitHub, Inc. (see above). The app loads:

- when you open, download or update a set, its lessons and images,
- when you open the Content page, the catalogue: recommended repositories,
  search indexes, media and book lists, and book covers,
- at the end of every lesson, the list of further media,
- when you add or validate a repository, redeem an invitation code or open a
  shared link to a set, an invitation or a repository, the files this needs.

In addition, the app checks on its own, without you clicking anything, whether
your sets have new versions and which reviews are due. To do so it reads the
manifest files of the official catalogue and of your connected repositories: on
start, when you move between pages and when the window comes back to the
foreground; it syncs connected repositories on start when the last sync is more
than a day old. Your browser usually answers repeated requests in quick
succession from its cache. The check runs on every page of the app except the
start page, creating your first learning project and the learning-type
assessment, so also on a first visit through a shared or direct link and on the
error page for a mistyped address, including addresses under /docs/.

GitHub receives your IP address, the usual browser data (browser type and
version, operating system, language setting), usually the origin of the
request (`astrapi69.github.io`) and the path of the requested file. The path
shows which repositories, sets and lessons you use, including repositories you
added yourself, and the invitation code when you redeem one. No cookies are set
or sent.

The legal basis is providing the feature for content you request (Art. 6 (1)
(b) GDPR), and for the automatic check the legitimate interest in showing you
current content and due reviews (Art. 6 (1) (f) GDPR). For the transfer to the
USA, see above.

## GitHub features with your own access token

Some features use the GitHub API (`api.github.com`) with a personal access
token that you enter yourself, in Settings under Integrations or for a single
repository. The token stays in your browser and is sent only to GitHub. With
it, the app acts in your name:

- It checks the token and reads your GitHub username in the process.
- It reads private repositories you connected, also during the automatic check
  above.
- It shares a lesson with the community: as a pull request to the operator's
  public repository `astrapi69/adaptive-learner-content`, through a copy (fork)
  in your account.
- It submits your own content repository for the search, also as a pull
  request to `astrapi69/adaptive-learner-content`.
- It exports a set to a new repository in your account, private by default.
- For coaches, it creates, lists and deactivates invitation codes in the
  `codes/` folder of their own repository.

Without a token, "Share with the community" opens GitHub's editing page
(`github.com`) instead; if the lesson fits into the address of that page, its
content is in it. "Prepare submission" (Settings > Data > Register your
repository) asks `api.github.com` for the latest state of the repository you
enter, with that repository's token if you stored one.

GitHub receives the token, your IP address, the usual browser data, the names
of repositories and files, and everything you share or export: the lesson or
the set's files, the commit message, the title and description of the pull
request with the lesson's details, the registry entry and, if you enter it,
your name as author. An invitation code contains the code, repository, branch,
maximum uses, expiry date, a note and, if you embed one, a read token; anyone
who can read the code file can read that token.

What you send to `astrapi69/adaptive-learner-content` becomes a public pull
request showing your GitHub username and, if given, your author name. The
operator receives it, reviews it and may add the contribution to the content
(Art. 6 (1) (b) and (f) GDPR). The pull request and the repository's version
history are kept for as long as the repository exists. For the other features
the legal basis is your request (Art. 6 (1) (b) GDPR). The recipient is
GitHub, Inc. (see above).

## Error reports

You prepare an error report with the button of an error message ("Report
Issue"), with "Report an issue" when a view could not be loaded, or with
"Create error report" in Settings under "Diagnostics & Support". You see the
report first. Only when you
click "Open on GitHub" does the app open a prefilled form for a new issue in
the repository `astrapi69/adaptive-learner` on `github.com` in a new tab. The
report is in the address of that page, so GitHub receives it as soon as the
tab opens, before you submit anything there. For an internal error while
creating a lesson, its "Report this problem" link opens such a form directly,
with that error message only.

The report contains the error message with technical details (such as status
code, endpoint, time or stack trace) and your own description. The app adds
environment details (app version, browser, operating system, current page) and
the action history (see Storage on your device) only if you tick the
respective box; both start unticked.

If you submit the issue on GitHub, it is public and linked to your GitHub
account. The operator receives it and uses it to fix the bug (Art. 6 (1) (f)
GDPR); it is kept for as long as the issue exists. The recipient is GitHub,
Inc. (see above).

## AI features with your own key

AI-assisted features exist only if you enter your own API key for a provider
in Settings under AI. Your browser then sends the requests directly to that
provider; the operator does not receive this data. You have your own contract
with the provider, and its terms and privacy notice apply. The recipient is
the provider whose key you use:

- Anthropic (`api.anthropic.com`): for customers in the EEA, Anthropic
  Ireland, Limited, 6th Floor, South Bank House, Barrow Street, Dublin 4, D04
  TR29, Ireland. The key travels in the request header.
- OpenAI (`api.openai.com`): for customers in the EEA, OpenAI Ireland Limited,
  1st Floor, The Liffey Trust Centre, 117-126 Sheriff Street Upper, Dublin 1,
  D01 YC43, Ireland. The key travels in the request header.
- Google (`generativelanguage.googleapis.com`, the Gemini API): for paid use
  with a billing address in the EEA, Google Cloud EMEA Limited, 70 Sir John
  Rogerson's Quay, Dublin 2, Ireland (with a billing address in France, Italy
  or Poland, the Google Cloud company there); for free use, Google LLC, 1600
  Amphitheatre Parkway, Mountain View, CA 94043, USA. Here the key travels in
  the request's address, not in its header.

Requests arise when you use an AI feature: learning sessions (including the
automatic evaluation of every step), "Ask AI" in lessons, the AI check of your
answers, generating exercises and lessons, analysing imported chats,
flashcards and the study guide, pronunciation practice, and the AI check and
generation of content. Without you typing anything, the app also sends:

- a query for the available models when you open the Session page or the model
  selection in Settings,
- a test request to a key's provider when you save the key, restore a key
  backup or click "Test", even if that provider is not the active one,
- once, the first requests of a learning session that you start from an
  imported chat; they contain the pasted chat.

Every request carries your key, your IP address and the usual browser data,
including the origin of the request (`astrapi69.github.io`). The model query
and the test request are the same query for the model list and contain nothing
else; after a successful query the app does not send it again for the same key
in the same tab for an hour. The other requests contain, depending on the
feature:

- your messages, questions and answers and the session's history so far,
- the learning content concerned (lessons, exercises, cards),
- the topic and goal of your learning project and your preferred learning
  method with its weight,
- titles and results of your completed lessons, the lesson you are working on
  and your recent mistakes with your answer and the expected one,
- for the study guide additionally the timeframe, minutes per day, all method
  weights, vocabulary from analysed chats and up to ten of your latest
  completed sessions with start time and method,
- for imported chats their title and the full pasted text,
- in pronunciation practice the target phrase and the recognised text of your
  attempt,
- the language the AI should answer in.

The legal basis is the feature you use (Art. 6 (1) (b) GDPR); for the model
query and the test request it is the legitimate interest in showing you the
available models and reporting an invalid key right away (Art. 6 (1) (f)
GDPR).

The providers may also process the data outside the EU, in particular in the
USA. According to its contract terms, Anthropic bases transfers to third
countries on standard data protection clauses adopted by the European
Commission (Art. 46 (2) (c) GDPR), OpenAI on standard data protection clauses
or an adequacy decision; Google LLC is certified under the EU-US Data Privacy
Framework (Art. 45 GDPR). The providers' privacy notices:

- [Anthropic](https://www.anthropic.com/legal/privacy)
- [OpenAI](https://openai.com/policies/eu-privacy-policy/)
- [Google](https://policies.google.com/privacy) and the
  [Gemini API terms](https://ai.google.dev/gemini-api/terms)

## Voice input

When you tap the microphone (in the learning session's input field and in
pronunciation practice), the app uses your browser's speech recognition.
Recording starts only after the tap, and your browser asks for permission to
use the microphone first. The browser does the recognition, not the app:
Google Chrome sends the recording and the selected language to a Google
service (`www.google.com`); other browsers behave as their maker decides. The
browser's maker is responsible for this processing, and its privacy notice
applies. For Chrome that is Google, for users in the EEA according to
[Google's privacy policy](https://policies.google.com/privacy) Google Ireland
Limited, Gordon House, Barrow Street, Dublin 4, Ireland; Google may also
process the data in the USA, and Google LLC is certified under the EU-US Data
Privacy Framework.

The app receives only the recognised text. In the learning session it lands in
the input field, in pronunciation practice in your attempt; when you send it,
it goes to your AI provider. The legal basis for starting the recognition is
your request (Art. 6 (1) (b) GDPR). In Settings under Learning, "Show
microphone button" hides voice input. Recordings in speaking exercises, on the
other hand, are made by the app itself and stay in your browser.

## Read-aloud

You start read-aloud with the read-aloud buttons, the R key or "Read all"; the
automatic read-aloud runs only if you switch it on. It reads lesson texts,
tasks, questions of the learning-type assessment, AI replies and phrases in
pronunciation practice. For this the app uses the speech output of your
browser or operating system. It picks a voice that works on your device and
falls back to an online voice only if there is no local voice for the
language or if you chose an online voice yourself in Settings.

An online voice sends the text to be read to its provider. In Google Chrome
these are Google voices; the text is then in the address of the request to
`www.google.com`. Chrome on Linux usually offers only such voices. The voice's
provider is responsible, for Chrome Google (see Voice input). The legal basis
is your request (Art. 6 (1) (b) GDPR).

## Share buttons

A share button appears on the Dashboard in the "Continue Learning" rows once
you have completed a lesson with a result, and at the end of a lesson if it is
switched on in Settings under Learning in "Lesson summary" (it is off by
default). If your device offers its own share dialog, the app opens it, and you
choose there where to share. Otherwise it shows links to Facebook, LinkedIn, X
and WhatsApp and an option to copy.

Only when you click one of these links does your browser open the network's
page; the network then receives your IP address, the usual browser data and
the cookies it has set on your device itself. Facebook and LinkedIn get only
the app's address; X and WhatsApp get a prefilled text with the lesson title,
your result (percentage and number of correct answers) and the app's address,
which you can still change before posting. The app embeds no scripts or
buttons of these networks; from the click on, their privacy notices apply. The
legal basis is your request (Art. 6 (1) (b) GDPR).

## External links

The app and these pages contain links to external services (among them
GitHub, Amazon, YouTube, AnkiWeb, donation platforms). Videos and images in
learning content or AI replies that point to other servers are also shown by
the app as a link; nothing loads until you click. With the click you leave
the app or these pages; from then on the respective provider's privacy notice
applies. No scripts, buttons or embedded content of these providers are
included.

## Storage on your device

What you create in the app is stored locally by your browser in IndexedDB and
localStorage: profile, learning projects, progress and statistics, notes,
imported chats, downloaded lessons, recordings from speaking exercises,
automatic backups and your settings, including your API keys and your GitHub
token, plus cached catalogues. The app also uses:

- sessionStorage, which your browser deletes when you close the tab, for the
  action history for error reports (your latest actions in the app, such as
  clicked buttons, page changes, selected options, messages and errors, but no
  keyboard input) and, if you entered an AI key, for your provider's model
  list, for one hour and stored under a short fingerprint of your key instead
  of the key itself,
- Cache Storage for the app's files and downloaded lessons, so that it also
  works offline.

These documentation pages store only the colour scheme (light or dark) in
localStorage. The public preview lives on the same domain
(`astrapi69.github.io`) as the app, so both share your browser's storage.

This storage is strictly necessary for the features you use and falls under
the exemption in Section 25 (2) no. 2 of the German TDDDG; no consent is
required. The storage itself transmits nothing; when data leaves your device
is described in the sections above. You can export or delete the data at any
time in Settings, or clear the site data in your browser.

## Contact by email

If you email the operator, your details are stored to handle the request
(Art. 6 (1) (b) and (f) GDPR) and deleted once the request is settled and no
statutory retention obligation applies.

## Your rights

Towards the controller you have the right of access (Art. 15 GDPR),
rectification (Art. 16), erasure (Art. 17), restriction of processing
(Art. 18), data portability (Art. 20) and objection to processing based on
legitimate interests (Art. 21). You may also lodge a complaint with a data
protection supervisory authority (Art. 77 GDPR), for example the authority at
your place of residence or at the controller's seat.

Because the operator does not hold your learning data, access and erasure
requests concerning that data are handled on your own device: Settings, Data,
Export or Delete. For contributions, error reports and emails the operator has
received from you, contact the email address given above.

## Changes

This policy is updated when the app or the legal situation changes. The date
of the current version is shown at the top.

See also the [legal notice](imprint.md).
