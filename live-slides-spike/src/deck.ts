// P0-1: hardcoded decks. This shape is a first sketch of the deck schema that Phase 1 formalizes.

export interface Bullet {
  id: string;
  text: string;
  /** Optional "what the speaker will probably say" phrases. Used only by the matcher, never shown. */
  cues?: string[];
}

export interface Slide {
  id: string;
  title: string;
  bullets: Bullet[];
}

export interface Deck {
  id: string;
  title: string;
  lang: 'en' | 'sv';
  /** BCP-47 tag handed to the speech recognizer. */
  speechLang: string;
  slides: Slide[];
}

/**
 * One spoken passage in a sample talk. `bullet: null` means off-topic talk that should highlight nothing.
 * A `|` in the text marks the cue point: the first moment a listener looking at the slide could tell
 * which bullet the speaker is on. Everything before it is lead-in.
 */
export interface ScriptLine {
  slide: string;
  bullet: string | null;
  text: string;
}

export const deckEn: Deck = {
  id: 'airplanes-en',
  title: 'How airplanes fly',
  lang: 'en',
  speechLang: 'en-US',
  slides: [
    {
      id: 's1',
      title: 'How a wing creates lift',
      bullets: [
        {
          id: 's1b1',
          text: 'The curved wing shape speeds up the air on top',
          cues: ['the wing is rounded on the upper side', 'air has to travel faster over the wing'],
        },
        {
          id: 's1b2',
          text: 'Lower pressure above pulls the wing upward',
          cues: ['a pressure difference between the top and the bottom', 'the wing gets sucked upward'],
        },
        {
          id: 's1b3',
          text: 'Tilting the wing increases lift: the angle of attack',
          cues: ['the pilot raises the nose to get more lift', 'the angle between the wing and the oncoming air'],
        },
        {
          id: 's1b4',
          text: 'Tilt too far and the wing stalls',
          cues: ['the airflow separates and the lift disappears', 'a stall is when the wing stops flying'],
        },
      ],
    },
    {
      id: 's2',
      title: 'Engines and thrust',
      bullets: [
        {
          id: 's2b1',
          text: 'A jet engine pulls in air and compresses it',
          cues: ['the fan at the front sucks in huge amounts of air', 'the compressor squeezes the air'],
        },
        {
          id: 's2b2',
          text: 'Fuel burns and hot gas blasts out the back',
          cues: ['kerosene is ignited in the combustion chamber', 'the exhaust pushes the plane forward'],
        },
        {
          id: 's2b3',
          text: 'Modern turbofans send most air around the core',
          cues: ['bypass air makes the engine quieter and more efficient', 'the big fan does most of the work'],
        },
        {
          id: 's2b4',
          text: 'Propellers win on short, slow routes',
          cues: ['turboprops are cheaper for regional flights', 'propeller planes burn less fuel at low speed'],
        },
      ],
    },
    {
      id: 's3',
      title: 'Staying in control',
      bullets: [
        {
          id: 's3b1',
          text: 'Ailerons on the wings roll the plane',
          cues: ['the flaps at the wingtips bank the aircraft left or right', 'rolling into a turn'],
        },
        {
          id: 's3b2',
          text: 'The elevator on the tail pitches the nose up or down',
          cues: ['pulling back on the stick to climb', 'the horizontal tail controls climbing and descending'],
        },
        {
          id: 's3b3',
          text: 'The rudder swings the nose left or right',
          cues: ['the vertical fin on the tail', 'yaw, used mostly in crosswind landings'],
        },
        {
          id: 's3b4',
          text: 'The autopilot flies most of a modern flight',
          cues: ['computers handle the cruise', 'pilots mainly fly by hand during takeoff and landing'],
        },
      ],
    },
  ],
};

// A sample talk that paraphrases the bullets instead of reading them, with a few off-topic asides.
export const scriptEn: ScriptLine[] = [
  { slide: 's1', bullet: null, text: 'Hi everyone, thanks for coming. Today I want to explain something we all take for granted.' },
  { slide: 's1', bullet: 's1b1', text: "Let's start with the shape.| If you slice a wing and look at it from the side, the upper surface is rounded, so the air going over it has to move faster." },
  { slide: 's1', bullet: 's1b2', text: 'And faster air means the pressure drops.| So you end up with less pressure above than below, and that difference literally sucks the wing up.' },
  { slide: 's1', bullet: null, text: 'It sounds a bit like magic the first time you hear it, I know.' },
  { slide: 's1', bullet: 's1b3', text: 'Now the pilot can get more out of this by raising the nose| a little. That changes the angle at which the wing meets the oncoming air, and lift goes up.' },
  { slide: 's1', bullet: 's1b4', text: 'But there is a limit. Go too steep| and the airflow separates from the surface, the lift collapses, and that is what we call a stall.' },
  { slide: 's2', bullet: 's2b1', text: "So how do we get moving in the first place? At the front of the engine there's a big fan that sucks in| enormous amounts of air and squeezes it together." },
  { slide: 's2', bullet: 's2b2', text: 'Then we add kerosene| and light it. The gas expands violently and shoots out the rear, and that pushes the whole aircraft forward.' },
  { slide: 's2', bullet: null, text: "By the way, if you've ever sat by the window you've probably noticed how huge these things have become." },
  { slide: 's2', bullet: 's2b3', text: "That's because on today's airliners most of the air actually goes around| the hot core. This bypass flow is what makes them quieter and much more fuel efficient." },
  { slide: 's2', bullet: 's2b4', text: 'For short regional hops| though, a propeller plane is often the smarter choice. At lower speeds a turboprop simply burns less.' },
  { slide: 's3', bullet: 's3b1', text: 'Finally, steering. Out on the wingtips| there are small hinged surfaces. Move one up and the other down and the plane banks into a turn.' },
  { slide: 's3', bullet: 's3b2', text: 'At the back, the horizontal tail| does the climbing and descending. Pull the stick back and the nose comes up.' },
  { slide: 's3', bullet: 's3b3', text: 'The vertical fin has its own hinged part. It yaws the nose sideways,| which matters most when you land in a crosswind.' },
  { slide: 's3', bullet: null, text: "Okay, we're almost at the end, just one more thing." },
  { slide: 's3', bullet: 's3b4', text: 'And honestly, for most of the trip nobody is hand flying| at all. The computers handle the cruise, and the crew takes over for takeoff and landing.' },
];

export const deckSv: Deck = {
  id: 'airplanes-sv',
  title: 'Så flyger ett flygplan',
  lang: 'sv',
  speechLang: 'sv-SE',
  slides: [
    {
      id: 's1',
      title: 'Så skapar vingen lyftkraft',
      bullets: [
        {
          id: 's1b1',
          text: 'Vingens välvda form får luften ovanpå att gå fortare',
          cues: ['vingen är rundad på ovansidan', 'luften måste röra sig snabbare över vingen'],
        },
        {
          id: 's1b2',
          text: 'Lägre tryck ovanför drar vingen uppåt',
          cues: ['en tryckskillnad mellan ovansidan och undersidan', 'vingen sugs uppåt'],
        },
        {
          id: 's1b3',
          text: 'Luta vingen för mer lyftkraft: anfallsvinkeln',
          cues: ['piloten höjer nosen för att få mer lyft', 'vinkeln mellan vingen och den mötande luften'],
        },
        {
          id: 's1b4',
          text: 'Lutar man för mycket överstegrar vingen',
          cues: ['luftströmmen släpper och lyftkraften försvinner', 'en stall är när vingen slutar flyga'],
        },
      ],
    },
    {
      id: 's2',
      title: 'Motorer och dragkraft',
      bullets: [
        {
          id: 's2b1',
          text: 'En jetmotor suger in luft och pressar ihop den',
          cues: ['fläkten längst fram drar in enorma mängder luft', 'kompressorn trycker ihop luften'],
        },
        {
          id: 's2b2',
          text: 'Bränslet förbränns och het gas sprutar ut bakåt',
          cues: ['flygfotogen antänds i brännkammaren', 'avgaserna trycker planet framåt'],
        },
        {
          id: 's2b3',
          text: 'Moderna turbofläktmotorer leder det mesta av luften runt kärnan',
          cues: ['luften som går förbi gör motorn tystare och snålare', 'den stora fläkten gör det mesta av jobbet'],
        },
        {
          id: 's2b4',
          text: 'Propellrar vinner på korta, långsamma sträckor',
          cues: ['turbopropplan är billigare på regionala linjer', 'propellerplan drar mindre bränsle i låg fart'],
        },
      ],
    },
    {
      id: 's3',
      title: 'Att hålla kontrollen',
      bullets: [
        {
          id: 's3b1',
          text: 'Skevrodren på vingarna rollar planet',
          cues: ['klaffarna vid vingspetsarna lutar planet åt vänster eller höger', 'man lutar planet in i en sväng'],
        },
        {
          id: 's3b2',
          text: 'Höjdrodret på stjärten pekar nosen uppåt eller nedåt',
          cues: ['man drar spaken bakåt för att stiga', 'den vågräta stjärten styr stigning och sjunkning'],
        },
        {
          id: 's3b3',
          text: 'Sidorodret vrider nosen åt vänster eller höger',
          cues: ['den lodräta fenan på stjärten', 'gir, används mest vid landning i sidvind'],
        },
        {
          id: 's3b4',
          text: 'Autopiloten flyger större delen av en modern flygning',
          cues: ['datorerna sköter marschflygningen', 'piloterna flyger mest för hand vid start och landning'],
        },
      ],
    },
  ],
};

export const scriptSv: ScriptLine[] = [
  { slide: 's1', bullet: null, text: 'Hej allihopa och välkomna. Idag tänkte jag förklara något som vi alla tar för givet.' },
  { slide: 's1', bullet: 's1b1', text: 'Vi börjar med formen.| Om man skär igenom en vinge och tittar från sidan så är ovansidan rundad, och då måste luften som går över den röra sig snabbare.' },
  { slide: 's1', bullet: 's1b2', text: 'Och snabbare luft betyder att trycket sjunker.| Man får alltså lägre tryck ovanför än under, och den skillnaden suger bokstavligen vingen uppåt.' },
  { slide: 's1', bullet: null, text: 'Det låter nästan som magi första gången man hör det, jag vet.' },
  { slide: 's1', bullet: 's1b3', text: 'Piloten kan få ut ännu mer genom att höja nosen| lite. Då ändras vinkeln som vingen möter luften med, och lyftkraften ökar.' },
  { slide: 's1', bullet: 's1b4', text: 'Men det finns en gräns. Blir det för brant| släpper luftströmmen från ytan, lyftkraften kollapsar, och det är det som kallas överstegring.' },
  { slide: 's2', bullet: 's2b1', text: 'Hur kommer vi då framåt överhuvudtaget? Längst fram i motorn sitter en stor fläkt som drar in| enorma mängder luft och trycker ihop den.' },
  { slide: 's2', bullet: 's2b2', text: 'Sedan tillsätter vi flygfotogen| och tänder på. Gasen expanderar våldsamt och sprutar ut baktill, och det trycker hela planet framåt.' },
  { slide: 's2', bullet: null, text: 'Förresten, om ni har suttit vid fönstret har ni säkert märkt hur enorma de har blivit.' },
  { slide: 's2', bullet: 's2b3', text: 'Det beror på att det mesta av luften faktiskt går runt| den heta kärnan på dagens trafikflygplan. Det är det som gör dem tystare och mycket bränslesnålare.' },
  { slide: 's2', bullet: 's2b4', text: 'På korta regionala sträckor| är däremot ett propellerplan ofta det smartare valet. I lägre fart drar en turboprop helt enkelt mindre.' },
  { slide: 's3', bullet: 's3b1', text: 'Till sist, styrningen. Ute vid vingspetsarna| sitter små rörliga ytor. Vinklar man en uppåt och den andra nedåt så lutar planet in i en sväng.' },
  { slide: 's3', bullet: 's3b2', text: 'Längst bak sköter den vågräta stjärten| stigning och sjunkning. Dra spaken bakåt så kommer nosen upp.' },
  { slide: 's3', bullet: 's3b3', text: 'Den lodräta fenan har också en rörlig del. Den vrider nosen i sidled,| och det behövs mest när man landar i sidvind.' },
  { slide: 's3', bullet: null, text: 'Okej, vi är nästan klara, bara en sak till.' },
  { slide: 's3', bullet: 's3b4', text: 'Och ärligt talat flyger ingen för hand| under större delen av resan. Datorerna sköter marschfarten och besättningen tar över vid start och landning.' },
];

export const DECKS: Record<string, { deck: Deck; script: ScriptLine[] }> = {
  en: { deck: deckEn, script: scriptEn },
  sv: { deck: deckSv, script: scriptSv },
};
