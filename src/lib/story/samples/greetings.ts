/**
 * Sample Story: First Greetings
 * A beginner-friendly story teaching basic Armenian greetings.
 */

import { createStory } from "../engine";

export const sampleStoryGreetings = createStory({
  id: "story_greetings_001",
  worldId: "w1",
  lessonId: "w1_l1",
  title: {
    en: "A Meeting in Yerevan",
    hy: "Հանդիպում Երևանում",
    ru: "Встреча в Ереване",
  },
  description: {
    en: "Learn how to greet people in Eastern Armenian through an interactive story.",
    hy: "Սովորիր ողջունել մարդկանց արևելահայերենով ինտերակտիվ պատմության միջոցով։",
    ru: "Научитесь приветствовать людей на восточноармянском через интерактивную историю.",
  },
  thumbnail: "/images/stories/yerevan-square.png",
  difficulty: "A1",
  estimatedMinutes: 8,
  characters: [
    {
      id: "nuri",
      name: { en: "Nuri", hy: "Նուրի", ru: "Нури" },
      avatar: "🍎",
      color: "text-primary",
      bgColor: "bg-primary/20",
    },
    {
      id: "anna",
      name: { en: "Anna", hy: "Աննա", ru: "Анна" },
      avatar: "👩",
      color: "text-secondary",
      bgColor: "bg-secondary/20",
    },
    {
      id: "aram",
      name: { en: "Aram", hy: "Արամ", ru: "Арам" },
      avatar: "👨",
      color: "text-accent",
      bgColor: "bg-accent/20",
    },
  ],
  nodes: [
    // Node 0: Opening narration
    {
      id: "node_0",
      type: "narration",
      text: {
        en: "It's a sunny morning in Yerevan. You're walking through Republic Square when you spot your friend Anna.",
        hy: "Արևոտ առավոտ է Երևանում։ Քայլում ես Հանրապետության հրապարակով, երբ տեսնում ես ընկերոջդ՝ Աննային։",
        ru: "Солнечное утро в Ереване. Вы идёте по площади Республики и видите свою подругу Анну.",
      },
      nextNodeId: "node_1",
    },
    // Node 1: First dialogue - greeting
    {
      id: "node_1",
      type: "dialogue",
      characterId: "anna",
      text: {
        en: "Hello! How are you?",
        hy: "Բարև՛: Ինչպե՞ս ես:",
        ru: "Привет! Как дела?",
      },
      translation: {
        en: "Hello! How are you?",
        hy: "Barev! Inchpes es?",
        ru: "Привет! Как дела?",
      },
      vocabularySpotlight: ["000001", "000002"],
      audio: {
        hy: "/audio/hy/000001.mp3",
        en: "/audio/en/000001.mp3",
        ru: "/audio/ru/000001.mp3",
      },
      nextNodeId: "node_2",
    },
    // Node 2: Choice - respond to greeting
    {
      id: "node_2",
      type: "choice",
      text: {
        en: "How do you respond?",
        hy: "Ինչպե՞ս ես պատասխանում:",
        ru: "Как вы ответите?",
      },
      choices: [
        {
          id: "choice_2a",
          text: { en: "Hello, I'm fine!", hy: "Բարև՛, լավ եմ:", ru: "Привет, хорошо!" },
          isCorrect: true,
          feedback: {
            en: "Perfect! You greeted Anna politely.",
            hy: "Հիանալի՛: Բարեգրագիր ողջունեցիր Աննային։",
            ru: "Отлично! Вы вежливо поприветствовали Анну.",
          },
          nextNodeId: "node_3",
        },
        {
          id: "choice_2b",
          text: { en: "Goodbye!", hy: "Ցտեսություն:", ru: "До свидания!" },
          isCorrect: false,
          feedback: {
            en: "Hmm, 'goodbye' isn't the right response when someone greets you. Let's try again!",
            hy: "Հմմ, «ցտեսություն»-ը ճիշտ պատասխան չէ, երբ ինչ-որ մեկը քեզ ողջունում է։ Եկ կրկին փորձենք։",
            ru: "Хм, 'до свидания' — не тот ответ на приветствие. Давайте попробуем ещё раз!",
          },
        },
        {
          id: "choice_2c",
          text: { en: "Thank you!", hy: "Շնորհակալություն:", ru: "Спасибо!" },
          isCorrect: false,
          feedback: {
            en: "'Thank you' is polite, but Anna asked how you are. Try answering that!",
            hy: "«Շնորհակալություն»-ը քաղաքավարի է, բայց Աննան հարցրեց, թե ինչպես ես։ Փորձիր պատասխանել դրան։",
            ru: "'Спасибо' — вежливо, но Анна спросила, как у вас дела. Попробуйте ответить на это!",
          },
        },
      ],
    },
    // Node 3: Anna's response
    {
      id: "node_3",
      type: "dialogue",
      characterId: "anna",
      text: {
        en: "I'm glad to see you! Where are you going?",
        hy: "Ուրախ եմ տեսնելու քեզ։ Ո՞ւր ես գնում։",
        ru: "Рада тебя видеть! Куда ты идёшь?",
      },
      vocabularySpotlight: ["000020", "000021"],
      nextNodeId: "node_4",
    },
    // Node 4: Vocabulary checkpoint
    {
      id: "node_4",
      type: "vocabulary",
      text: {
        en: "Let's review the words you've learned so far.",
        hy: "Եկ կրկնենք բառերը, որոնք մինչ այժմ սովորեցիր։",
        ru: "Давайте повторим слова, которые вы уже выучили.",
      },
      vocabularySpotlight: ["000001", "000002", "000020", "000021"],
      nextNodeId: "node_5",
    },
    // Node 5: Continue story
    {
      id: "node_5",
      type: "dialogue",
      characterId: "anna",
      text: {
        en: "I'm going to the market. Would you like to come with me?",
        hy: "Գնում եմ շուկա։ Կուզենայիր գալ ինձ հետ:",
        ru: "Я иду на рынок. Хочешь пойти со мной?",
      },
      nextNodeId: "node_6",
    },
    // Node 6: Final choice
    {
      id: "node_6",
      type: "choice",
      text: {
        en: "What do you say?",
        hy: "Ինչ ես ասում։",
        ru: "Что вы скажете?",
      },
      choices: [
        {
          id: "choice_6a",
          text: { en: "Yes, let's go!", hy: "Այո՛, եկ գնանք:", ru: "Да, пойдём!" },
          isCorrect: true,
          nextNodeId: "node_7",
        },
        {
          id: "choice_6b",
          text: { en: "No, I'm busy.", hy: "Ոչ, զբաղված եմ:", ru: "Нет, я занят." },
          isCorrect: true, // Also acceptable
          nextNodeId: "node_7b",
        },
      ],
    },
    // Node 7: Ending - going to market
    {
      id: "node_7",
      type: "narration",
      text: {
        en: "You and Anna walk together towards the market, practicing Armenian along the way. Great job! You completed your first Armenian conversation!",
        hy: "Դու և Աննան միասին գնում ես դեպի շուկա՝ ճանապարհին հայերեն եր կի անում։ Հիանալի՛ աշխատանք։ Ավարտեցիր քո առաջին հայերեն զրույցը։",
        ru: "Вы и Анна идёте вместе на рынок, практикуя армянский по дороге. Отличная работа! Вы завершили свой первый разговор на армянском!",
      },
      nextNodeId: "checkpoint_final",
    },
    // Node 7b: Alternative ending
    {
      id: "node_7b",
      type: "narration",
      text: {
        en: "Anna understands. 'Maybe next time!' she says with a smile. You've practiced your first Armenian greetings!",
        hy: "Աննան հասկանում է։ «Մա՜յբ հաջորդ անգամ», — ասում է ժպտալով։ Ես կիրառեցիր քո առաջին հայերեն ողջույնները։",
        ru: "Анна понимает. 'Может, в следующий раз!' — говорит она с улыбкой. Вы потренировали свои первые приветствия на армянском!",
      },
      nextNodeId: "checkpoint_final",
    },
    // Final checkpoint
    {
      id: "checkpoint_final",
      type: "checkpoint",
      text: {
        en: "Story Complete! You've learned basic greetings in Armenian.",
        hy: "Պատմությունն ավարտվեց։ Սովորեցիր հիմնական ողջույններ հայերենով։",
        ru: "История завершена! Вы выучили основные приветствия на армянском.",
      },
      vocabularySpotlight: ["000001", "000002", "000020", "000021"],
    },
  ],
  startNodeId: "node_0",
  vocabularyCovered: ["000001", "000002", "000020", "000021"],
  rewards: {
    hayq: 15,
    xp: 30,
  },
});

export default sampleStoryGreetings;
