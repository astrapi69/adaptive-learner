"""12 assessment questions in DE + EN with per-method weight tags.

Each answer carries a ``weights`` dict mapping one or more of the
six method keys to a float in ``[0.0, 1.0]``. The profile
calculator (see :mod:`.profile`) sums these contributions across
all 12 answers and normalises by the question count, so each
method ends up in ``[0.0, 1.0]`` representing "what fraction of
your answers leaned toward this method".

Weights are designed so that:

- A purely-one-method respondent (always picks the answer fully
  weighted to method X) scores 1.0 on X and 0.0 elsewhere.
- A balanced respondent scores ~0.17 on each method.
- The dominant method is unambiguous for clearly typed
  respondents; ties resolve alphabetically via
  :attr:`app.models.LearningProfile.dominant_method`.

Translations are maintainer-authored (DE + EN both produced by
the project owner who is bilingual). When adding a new question,
keep ``id`` strictly numeric-suffixed (``q13`` etc.) so an
external tooling chain can rely on the ordering without parsing
prose.
"""

from __future__ import annotations

from typing import Any, TypedDict

# --- The six method keys (must match :mod:`app.schemas.LearningMethod`) ---

METHODS: tuple[str, ...] = (
    "deductive",
    "inductive",
    "error_based",
    "dialogic",
    "contextual",
    "ai_adaptive",
)


class Answer(TypedDict, total=False):
    """Per-answer payload. ``text_es`` / ``text_fr`` / ``text_el``
    are optional: questions added before Phase 5F's translation
    pass don't carry them. ``_text_key`` falls back to EN for any
    language that doesn't have a translation registered yet.
    """

    id: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    weights: dict[str, float]


class Question(TypedDict, total=False):
    id: str
    text_de: str
    text_en: str
    text_es: str
    text_fr: str
    text_el: str
    answers: list[Answer]


QUESTIONS: list[Question] = [
    {
        "id": "q01",
        "text_de": "Wie gehst du an ein neues Thema heran?",
        "text_en": "How do you approach a new topic?",
        "text_es": "Como abordas un tema nuevo?",
        "text_fr": "Comment abordes-tu un nouveau sujet ?",
        "text_el": "Πώς προσεγγίζεις ένα νέο θέμα;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich lese erst die Regeln und Theorie.",
                "text_en": "I read the rules and theory first.",
                "text_es": "Primero leo las reglas y la teoria.",
                "text_fr": "Je lis d'abord les regles et la theorie.",
                "text_el": "Διαβάζω πρώτα τους κανόνες και τη θεωρία.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich schaue mir Beispiele an und leite die Regel selbst ab.",
                "text_en": "I look at examples and derive the rule myself.",
                "text_es": "Miro ejemplos y deduzco la regla por mi mismo.",
                "text_fr": "Je regarde des exemples et je deduis la regle moi-meme.",
                "text_el": "Κοιτάω παραδείγματα και βγάζω μόνος τον κανόνα.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere etwas und lerne aus Fehlern.",
                "text_en": "I try something and learn from mistakes.",
                "text_es": "Pruebo algo y aprendo de los errores.",
                "text_fr": "J'essaie quelque chose et j'apprends de mes erreurs.",
                "text_el": "Δοκιμάζω κάτι και μαθαίνω από τα λάθη.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich bespreche es mit jemandem, der es bereits kennt.",
                "text_en": "I discuss it with someone who already knows it.",
                "text_es": "Lo hablo con alguien que ya lo conoce.",
                "text_fr": "J'en discute avec quelqu'un qui le connait deja.",
                "text_el": "Το συζητάω με κάποιον που ήδη το ξέρει.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q02",
        "text_de": "Wenn du einen Fehler machst, was hilft dir am meisten?",
        "text_en": "When you make a mistake, what helps you most?",
        "text_es": "Cuando cometes un error, que te ayuda mas?",
        "text_fr": "Quand tu fais une erreur, qu'est-ce qui t'aide le plus ?",
        "text_el": "Όταν κάνεις λάθος, τι σε βοηθάει περισσότερο;",
        "answers": [
            {
                "id": "a",
                "text_de": "Eine klare Erklärung, warum es falsch war.",
                "text_en": "A clear explanation of why it was wrong.",
                "text_es": "Una explicacion clara de por que estuvo mal.",
                "text_fr": "Une explication claire de pourquoi c'etait faux.",
                "text_el": "Μια ξεκάθαρη εξήγηση γιατί ήταν λάθος.",
                "weights": {"deductive": 0.5, "error_based": 0.5},
            },
            {
                "id": "b",
                "text_de": "Den Fehler selbst nochmal durchgehen und korrigieren.",
                "text_en": "Walking through the mistake again and correcting it.",
                "text_es": "Repasar el error y corregirlo.",
                "text_fr": "Reprendre l'erreur et la corriger.",
                "text_el": "Να ξαναπεράσω το λάθος και να το διορθώσω.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "c",
                "text_de": "Mit jemandem darüber sprechen, der den Fehler einordnen kann.",
                "text_en": "Talking to someone who can put the mistake in context.",
                "text_es": "Hablar con alguien que pueda contextualizar el error.",
                "text_fr": "Parler a quelqu'un qui peut replacer l'erreur dans son contexte.",
                "text_el": "Να μιλήσω με κάποιον που μπορεί να βάλει το λάθος σε πλαίσιο.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein Beispiel sehen, wo es richtig gemacht wurde.",
                "text_en": "Seeing an example where it was done correctly.",
                "text_es": "Ver un ejemplo donde se hizo bien.",
                "text_fr": "Voir un exemple ou cela a ete fait correctement.",
                "text_el": "Να δω ένα παράδειγμα όπου έγινε σωστά.",
                "weights": {"inductive": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q03",
        "text_de": "Welches Lerntempo fühlt sich richtig an?",
        "text_en": "Which learning pace feels right?",
        "text_es": "Que ritmo de aprendizaje te resulta adecuado?",
        "text_fr": "Quel rythme d'apprentissage te convient ?",
        "text_el": "Ποιος ρυθμός μάθησης σου φαίνεται σωστός;",
        "answers": [
            {
                "id": "a",
                "text_de": "Strukturiert und vorhersehbar.",
                "text_en": "Structured and predictable.",
                "text_es": "Estructurado y predecible.",
                "text_fr": "Structure et previsible.",
                "text_el": "Δομημένος και προβλέψιμος.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Schnell und ausprobierend.",
                "text_en": "Fast and exploratory.",
                "text_es": "Rapido y exploratorio.",
                "text_fr": "Rapide et exploratoire.",
                "text_el": "Γρήγορος και εξερευνητικός.",
                "weights": {"error_based": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Anpassbar an meine Tagesform.",
                "text_en": "Adaptable to my daily energy.",
                "text_es": "Adaptable a mi energia diaria.",
                "text_fr": "Adaptable a mon energie du jour.",
                "text_el": "Προσαρμόσιμος στην ημερήσια ενέργειά μου.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Im Gespräch, so wie es sich entwickelt.",
                "text_en": "Conversationally, however it develops.",
                "text_es": "Conversacional, como se vaya dando.",
                "text_fr": "Conversationnel, au fil de l'echange.",
                "text_el": "Συνομιλιακός, όπως κι αν εξελιχθεί.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q04",
        "text_de": "Wo lernst du am besten?",
        "text_en": "Where do you learn best?",
        "text_es": "Donde aprendes mejor?",
        "text_fr": "Ou apprends-tu le mieux ?",
        "text_el": "Πού μαθαίνεις καλύτερα;",
        "answers": [
            {
                "id": "a",
                "text_de": "Allein, mit einem Buch oder Skript.",
                "text_en": "Alone, with a book or script.",
                "text_es": "A solas, con un libro o apuntes.",
                "text_fr": "Seul, avec un livre ou des notes.",
                "text_el": "Μόνος, με βιβλίο ή σημειώσεις.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "In einer echten Anwendungssituation.",
                "text_en": "In a real-world application setting.",
                "text_es": "En una situacion de aplicacion real.",
                "text_fr": "Dans un contexte d'application reel.",
                "text_el": "Σε ένα πραγματικό πλαίσιο εφαρμογής.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Im Gespräch mit anderen.",
                "text_en": "In conversation with others.",
                "text_es": "En conversacion con otros.",
                "text_fr": "En conversation avec d'autres.",
                "text_el": "Σε συζήτηση με άλλους.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "An einem Projekt, das mich interessiert.",
                "text_en": "On a project that interests me.",
                "text_es": "En un proyecto que me interesa.",
                "text_fr": "Sur un projet qui m'interesse.",
                "text_el": "Σε ένα έργο που με ενδιαφέρει.",
                "weights": {"contextual": 0.7, "error_based": 0.3},
            },
        ],
    },
    {
        "id": "q05",
        "text_de": "Wie merkst du dir am besten Neues?",
        "text_en": "How do you remember new things best?",
        "text_es": "Como recuerdas mejor las cosas nuevas?",
        "text_fr": "Comment te souviens-tu le mieux de nouvelles choses ?",
        "text_el": "Πώς θυμάσαι καλύτερα νέα πράγματα;",
        "answers": [
            {
                "id": "a",
                "text_de": "Durch Wiederholung und feste Regeln.",
                "text_en": "Through repetition and fixed rules.",
                "text_es": "Mediante repeticion y reglas fijas.",
                "text_fr": "Par la repetition et des regles fixes.",
                "text_el": "Μέσα από επανάληψη και σταθερούς κανόνες.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Durch echte Anwendung im Alltag.",
                "text_en": "Through real application in everyday life.",
                "text_es": "Mediante la aplicacion real en la vida cotidiana.",
                "text_fr": "Par l'application reelle au quotidien.",
                "text_el": "Μέσα από πραγματική εφαρμογή στην καθημερινότητα.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "c",
                "text_de": "Durch mehrfache eigene Fehler und Korrekturen.",
                "text_en": "Through multiple personal mistakes + corrections.",
                "text_es": "A traves de multiples errores y correcciones propias.",
                "text_fr": "A travers plusieurs erreurs et corrections personnelles.",
                "text_el": "Μέσα από πολλά προσωπικά λάθη και διορθώσεις.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Durch Diskussion und Erklären an andere.",
                "text_en": "Through discussion and explaining to others.",
                "text_es": "Discutiendo y explicando a otros.",
                "text_fr": "En discutant et en expliquant aux autres.",
                "text_el": "Μέσα από συζήτηση και εξήγηση σε άλλους.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q06",
        "text_de": "Welche Ressource hilft dir am meisten?",
        "text_en": "Which resource helps you most?",
        "text_es": "Que recurso te ayuda mas?",
        "text_fr": "Quelle ressource t'aide le plus ?",
        "text_el": "Ποιος πόρος σε βοηθάει περισσότερο;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ein gut strukturiertes Lehrbuch.",
                "text_en": "A well-structured textbook.",
                "text_es": "Un libro de texto bien estructurado.",
                "text_fr": "Un manuel bien structure.",
                "text_el": "Ένα καλά δομημένο εγχειρίδιο.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Beispiel-orientierte Tutorials oder Videos.",
                "text_en": "Example-driven tutorials or videos.",
                "text_es": "Tutoriales o videos basados en ejemplos.",
                "text_fr": "Des tutoriels ou videos centres sur des exemples.",
                "text_el": "Tutorial ή βίντεο βασισμένα σε παραδείγματα.",
                "weights": {"inductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Reale Projekte oder Fallstudien.",
                "text_en": "Real-world projects or case studies.",
                "text_es": "Proyectos reales o estudios de caso.",
                "text_fr": "Des projets reels ou des etudes de cas.",
                "text_el": "Πραγματικά έργα ή μελέτες περίπτωσης.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ein erfahrener Mensch, der mich begleitet.",
                "text_en": "An experienced person who guides me.",
                "text_es": "Una persona con experiencia que me guie.",
                "text_fr": "Une personne experimentee qui me guide.",
                "text_el": "Ένα έμπειρο άτομο που με καθοδηγεί.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q07",
        "text_de": "Wie reagierst du auf Unsicherheit beim Lernen?",
        "text_en": "How do you react to uncertainty while learning?",
        "text_es": "Como reaccionas ante la incertidumbre al aprender?",
        "text_fr": "Comment reagis-tu a l'incertitude en apprenant ?",
        "text_el": "Πώς αντιδράς στην αβεβαιότητα κατά τη μάθηση;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich suche eine eindeutige Quelle, die sie auflöst.",
                "text_en": "I find an unambiguous source that resolves it.",
                "text_es": "Busco una fuente clara que la resuelva.",
                "text_fr": "Je cherche une source sans ambiguite qui la resout.",
                "text_el": "Βρίσκω μια ξεκάθαρη πηγή που τη λύνει.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich frage jemanden, dem ich vertraue.",
                "text_en": "I ask someone I trust.",
                "text_es": "Le pregunto a alguien de confianza.",
                "text_fr": "Je demande a quelqu'un de confiance.",
                "text_el": "Ρωτάω κάποιον που εμπιστεύομαι.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Ich probiere weiter und sortiere unterwegs.",
                "text_en": "I keep trying and sort things out as I go.",
                "text_es": "Sigo intentando y voy resolviendo sobre la marcha.",
                "text_fr": "Je continue d'essayer et je demele en chemin.",
                "text_el": "Συνεχίζω να προσπαθώ και ξεδιαλύνω καθώς προχωράω.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mich von einem KI-Assistenten leiten.",
                "text_en": "I let an AI assistant guide me.",
                "text_es": "Dejo que un asistente de IA me guie.",
                "text_fr": "Je laisse un assistant IA me guider.",
                "text_el": "Αφήνω έναν βοηθό AI να με καθοδηγήσει.",
                "weights": {"ai_adaptive": 1.0},
            },
        ],
    },
    {
        "id": "q08",
        "text_de": "Wann sitzt der Stoff für dich wirklich?",
        "text_en": "When does material really stick for you?",
        "text_es": "Cuando se te queda realmente el material?",
        "text_fr": "Quand la matiere s'ancre-t-elle vraiment chez toi ?",
        "text_el": "Πότε εμπεδώνεται πραγματικά η ύλη για σένα;",
        "answers": [
            {
                "id": "a",
                "text_de": "Wenn ich ihn in einem echten Kontext angewendet habe.",
                "text_en": "When I've applied it in a real context.",
                "text_es": "Cuando lo he aplicado en un contexto real.",
                "text_fr": "Quand je l'ai applique dans un contexte reel.",
                "text_el": "Όταν το έχω εφαρμόσει σε πραγματικό πλαίσιο.",
                "weights": {"contextual": 1.0},
            },
            {
                "id": "b",
                "text_de": "Wenn ich die Regel sauber abstrahieren kann.",
                "text_en": "When I can cleanly abstract the rule.",
                "text_es": "Cuando puedo abstraer la regla con claridad.",
                "text_fr": "Quand je peux abstraire la regle proprement.",
                "text_el": "Όταν μπορώ να αφαιρέσω καθαρά τον κανόνα.",
                "weights": {"deductive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Wenn ich es jemandem erklärt habe.",
                "text_en": "When I've explained it to someone.",
                "text_es": "Cuando se lo he explicado a alguien.",
                "text_fr": "Quand je l'ai explique a quelqu'un.",
                "text_el": "Όταν το έχω εξηγήσει σε κάποιον.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "d",
                "text_de": "Wenn ich genug Fehler gemacht und korrigiert habe.",
                "text_en": "When I've made + corrected enough mistakes.",
                "text_es": "Cuando he cometido y corregido suficientes errores.",
                "text_fr": "Quand j'ai fait et corrige assez d'erreurs.",
                "text_el": "Όταν έχω κάνει και διορθώσει αρκετά λάθη.",
                "weights": {"error_based": 1.0},
            },
        ],
    },
    {
        "id": "q09",
        "text_de": "Wer legt am liebsten dein Lernprogramm fest?",
        "text_en": "Who do you prefer to set your learning programme?",
        "text_es": "Quien prefieres que defina tu programa de aprendizaje?",
        "text_fr": "Qui preferes-tu pour fixer ton programme d'apprentissage ?",
        "text_el": "Ποιος προτιμάς να καθορίζει το πρόγραμμα μάθησής σου;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich selbst, nach klarem Plan.",
                "text_en": "Myself, on a clear plan.",
                "text_es": "Yo, sobre un plan claro.",
                "text_fr": "Moi-meme, avec un plan clair.",
                "text_el": "Εγώ ο ίδιος, με ξεκάθαρο πλάνο.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Eine Mentorin oder ein Coach.",
                "text_en": "A mentor or coach.",
                "text_es": "Un mentor o coach.",
                "text_fr": "Un mentor ou coach.",
                "text_el": "Ένας μέντορας ή coach.",
                "weights": {"dialogic": 1.0},
            },
            {
                "id": "c",
                "text_de": "Eine KI, die meine Fortschritte einbezieht.",
                "text_en": "An AI that incorporates my progress.",
                "text_es": "Una IA que incorpore mi progreso.",
                "text_fr": "Une IA qui integre ma progression.",
                "text_el": "Μια AI που ενσωματώνει την πρόοδό μου.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "d",
                "text_de": "Das Thema selbst — ich folge meinen Fragen.",
                "text_en": "The topic itself — I follow my own questions.",
                "text_es": "El tema en si — sigo mis propias preguntas.",
                "text_fr": "Le sujet lui-meme — je suis mes propres questions.",
                "text_el": "Το ίδιο το θέμα — ακολουθώ τις δικές μου ερωτήσεις.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
        ],
    },
    {
        "id": "q10",
        "text_de": "Wann möchtest du Feedback bekommen?",
        "text_en": "When do you want feedback?",
        "text_es": "Cuando quieres feedback?",
        "text_fr": "Quand veux-tu un retour ?",
        "text_el": "Πότε θέλεις ανατροφοδότηση;",
        "answers": [
            {
                "id": "a",
                "text_de": "Sofort nach jedem Schritt.",
                "text_en": "Immediately after every step.",
                "text_es": "Inmediatamente despues de cada paso.",
                "text_fr": "Immediatement apres chaque etape.",
                "text_el": "Αμέσως μετά από κάθε βήμα.",
                "weights": {"error_based": 0.7, "dialogic": 0.3},
            },
            {
                "id": "b",
                "text_de": "Am Ende einer abgeschlossenen Einheit.",
                "text_en": "At the end of a completed unit.",
                "text_es": "Al final de una unidad completada.",
                "text_fr": "A la fin d'une unite terminee.",
                "text_el": "Στο τέλος μιας ολοκληρωμένης ενότητας.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "c",
                "text_de": "Wenn ich ausdrücklich frage.",
                "text_en": "When I explicitly ask for it.",
                "text_es": "Cuando lo pido explicitamente.",
                "text_fr": "Quand je le demande explicitement.",
                "text_el": "Όταν το ζητήσω ρητά.",
                "weights": {"inductive": 0.5, "ai_adaptive": 0.5},
            },
            {
                "id": "d",
                "text_de": "Im Gespräch, im Hin und Her.",
                "text_en": "In conversation, back and forth.",
                "text_es": "En conversacion, ida y vuelta.",
                "text_fr": "En conversation, dans un va-et-vient.",
                "text_el": "Σε συζήτηση, πέρα-δώθε.",
                "weights": {"dialogic": 1.0},
            },
        ],
    },
    {
        "id": "q11",
        "text_de": "Wie stehst du zu KI-Tools beim Lernen?",
        "text_en": "How do you feel about AI tools while learning?",
        "text_es": "Que opinas de las herramientas de IA al aprender?",
        "text_fr": "Que penses-tu des outils d'IA pour apprendre ?",
        "text_el": "Πώς νιώθεις για τα εργαλεία AI στη μάθηση;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich nutze sie als Hauptbegleiter.",
                "text_en": "I use them as my main companion.",
                "text_es": "Las uso como mi principal compañero.",
                "text_fr": "Je les utilise comme mon compagnon principal.",
                "text_el": "Τα χρησιμοποιώ ως κύριο συνοδό.",
                "weights": {"ai_adaptive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Selektiv — wenn ich konkrete Fragen habe.",
                "text_en": "Selectively — when I have specific questions.",
                "text_es": "De forma selectiva — cuando tengo preguntas concretas.",
                "text_fr": "De maniere selective — quand j'ai des questions precises.",
                "text_el": "Επιλεκτικά — όταν έχω συγκεκριμένες ερωτήσεις.",
                "weights": {"ai_adaptive": 0.5, "inductive": 0.5},
            },
            {
                "id": "c",
                "text_de": "Eher selten; ich vertraue Büchern und Menschen.",
                "text_en": "Rarely; I trust books and people more.",
                "text_es": "Pocas veces; confio mas en libros y personas.",
                "text_fr": "Rarement ; je fais davantage confiance aux livres et aux personnes.",
                "text_el": "Σπάνια· εμπιστεύομαι περισσότερο τα βιβλία και τους ανθρώπους.",
                "weights": {"deductive": 0.5, "dialogic": 0.5},
            },
            {
                "id": "d",
                "text_de": "Erst nachdem ich es ohne probiert habe.",
                "text_en": "Only after I've tried without one first.",
                "text_es": "Solo despues de haberlo intentado sin ellas primero.",
                "text_fr": "Seulement apres avoir essaye sans elles d'abord.",
                "text_el": "Μόνο αφού πρώτα δοκιμάσω χωρίς αυτά.",
                "weights": {"error_based": 0.7, "contextual": 0.3},
            },
        ],
    },
    {
        "id": "q12",
        "text_de": "Wie verhältst du dich bei Stoff, der nicht klick macht?",
        "text_en": "How do you respond to material that just won't click?",
        "text_es": "Como respondes ante material que no te entra?",
        "text_fr": "Comment reagis-tu face a une matiere qui ne passe pas ?",
        "text_el": "Πώς αντιδράς σε ύλη που δεν κουμπώνει;",
        "answers": [
            {
                "id": "a",
                "text_de": "Ich gehe zurück zur Theorie und lese nochmal genau.",
                "text_en": "I go back to the theory and read more carefully.",
                "text_es": "Vuelvo a la teoria y leo con mas atencion.",
                "text_fr": "Je retourne a la theorie et je lis plus attentivement.",
                "text_el": "Επιστρέφω στη θεωρία και διαβάζω πιο προσεκτικά.",
                "weights": {"deductive": 1.0},
            },
            {
                "id": "b",
                "text_de": "Ich suche mehr Beispiele aus der Praxis.",
                "text_en": "I look for more examples from real practice.",
                "text_es": "Busco mas ejemplos de la practica real.",
                "text_fr": "Je cherche plus d'exemples de la pratique reelle.",
                "text_el": "Ψάχνω περισσότερα παραδείγματα από την πραγματική πράξη.",
                "weights": {"inductive": 0.5, "contextual": 0.5},
            },
            {
                "id": "c",
                "text_de": "Ich versuche es bis es klappt — auch mit Fehlern.",
                "text_en": "I keep trying until it works — mistakes included.",
                "text_es": "Sigo intentando hasta que funciona — errores incluidos.",
                "text_fr": "Je continue jusqu'a ce que cela fonctionne — erreurs comprises.",
                "text_el": "Συνεχίζω να προσπαθώ μέχρι να πετύχει — με τα λάθη.",
                "weights": {"error_based": 1.0},
            },
            {
                "id": "d",
                "text_de": "Ich lasse mir den Weg von einer KI vorschlagen.",
                "text_en": "I let an AI suggest the path.",
                "text_es": "Dejo que una IA me sugiera el camino.",
                "text_fr": "Je laisse une IA proposer le chemin.",
                "text_el": "Αφήνω μια AI να προτείνει την πορεία.",
                "weights": {"ai_adaptive": 1.0},
            },
        ],
    },
]


_LANG_TO_KEY: dict[str, str] = {
    "de": "text_de",
    "en": "text_en",
    "es": "text_es",
    "fr": "text_fr",
    "el": "text_el",
}


def _text_key(lang: str) -> str:
    """Map a UI language code to the in-file translation key.

    v0.2.0 ships DE + EN + ES + FR + EL. Any code that doesn't
    match (PT / TR / JA / unknown) falls back to EN. Future
    translation packs add a row to ``_LANG_TO_KEY`` AND populate
    the matching field in every QUESTIONS entry.
    """
    # Match the most-specific 2-char prefix first so ``en-US`` /
    # ``de-AT`` etc. resolve to the base language.
    for prefix, key in _LANG_TO_KEY.items():
        if lang.startswith(prefix):
            return key
    return "text_en"


def questions_for_lang(lang: str) -> list[dict[str, Any]]:
    """Return the 12-question pack, with ``text`` resolved for ``lang``.

    Output shape matches the project plan §6.3 contract::

        [{"id": "q01",
          "text": "...",
          "answers": [{"id": "a", "text": "...", "weights": {...}}, ...]},
         ...]
    """
    key = _text_key(lang)
    out: list[dict[str, Any]] = []
    for q in QUESTIONS:
        # v0.2.0: a future question added without ES / FR / EL
        # translations gracefully falls back to EN. The
        # `total=False` TypedDicts mean ``.get`` is the right
        # access pattern.
        q_text = q.get(key) or q["text_en"]  # type: ignore[arg-type]
        out.append(
            {
                "id": q["id"],
                "text": q_text,
                "answers": [
                    {
                        "id": a["id"],
                        "text": a.get(key) or a["text_en"],  # type: ignore[arg-type]
                        "weights": dict(a["weights"]),
                    }
                    for a in q["answers"]
                ],
            }
        )
    return out


def lang_neutral_questions() -> list[dict[str, Any]]:
    """Variant used by the profile calculator: drops the text, keeps
    the answer-id -> weights mapping. Cheaper to lookup at evaluation
    time than rebuilding the structure per request.
    """
    out: list[dict[str, Any]] = []
    for q in QUESTIONS:
        out.append(
            {
                "id": q["id"],
                "answers": [{"id": a["id"], "weights": dict(a["weights"])} for a in q["answers"]],
            }
        )
    return out
