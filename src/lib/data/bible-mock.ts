import type { Book, Verse } from '@/types'

export const BOOKS: Book[] = [
  { id: 'genesis', name: 'Genesis', testament: 'old', chapters: 50 },
  { id: 'exodus', name: 'Exodus', testament: 'old', chapters: 40 },
  { id: 'psalms', name: 'Psalms', testament: 'old', chapters: 150 },
  { id: 'proverbs', name: 'Proverbs', testament: 'old', chapters: 31 },
  { id: 'isaiah', name: 'Isaiah', testament: 'old', chapters: 66 },
  { id: 'matthew', name: 'Matthew', testament: 'new', chapters: 28 },
  { id: 'mark', name: 'Mark', testament: 'new', chapters: 16 },
  { id: 'luke', name: 'Luke', testament: 'new', chapters: 24 },
  { id: 'john', name: 'John', testament: 'new', chapters: 21 },
  { id: 'acts', name: 'Acts', testament: 'new', chapters: 28 },
  { id: 'romans', name: 'Romans', testament: 'new', chapters: 16 },
  { id: '1corinthians', name: '1 Corinthians', testament: 'new', chapters: 16 },
  { id: 'galatians', name: 'Galatians', testament: 'new', chapters: 6 },
  { id: 'philippians', name: 'Philippians', testament: 'new', chapters: 4 },
  { id: 'revelation', name: 'Revelation', testament: 'new', chapters: 22 },
]

export const MOCK_VERSES: Record<string, Verse[]> = {
  'john-3': [
    { id: 'john-3-1', book: 'john', chapter: 3, verse: 1, text: 'There was a man of the Pharisees named Nicodemus, a ruler of the Jews.' },
    { id: 'john-3-2', book: 'john', chapter: 3, verse: 2, text: 'This man came to Jesus by night and said to him, "Rabbi, we know that you are a teacher come from God, for no one can do these signs that you do unless God is with him."' },
    { id: 'john-3-3', book: 'john', chapter: 3, verse: 3, text: 'Jesus answered him, "Truly, truly, I say to you, unless one is born again he cannot see the kingdom of God."' },
    { id: 'john-3-4', book: 'john', chapter: 3, verse: 4, text: 'Nicodemus said to him, "How can a man be born when he is old? Can he enter a second time into his mother\'s womb and be born?"' },
    { id: 'john-3-5', book: 'john', chapter: 3, verse: 5, text: 'Jesus answered, "Truly, truly, I say to you, unless one is born of water and the Spirit, he cannot enter the kingdom of God."' },
    { id: 'john-3-6', book: 'john', chapter: 3, verse: 6, text: 'That which is born of the flesh is flesh, and that which is born of the Spirit is spirit.' },
    { id: 'john-3-7', book: 'john', chapter: 3, verse: 7, text: 'Do not marvel that I said to you, \'You must be born again.\'' },
    { id: 'john-3-8', book: 'john', chapter: 3, verse: 8, text: 'The wind blows where it wishes, and you hear its sound, but you do not know where it comes from or where it goes. So it is with everyone who is born of the Spirit.' },
    { id: 'john-3-9', book: 'john', chapter: 3, verse: 9, text: 'Nicodemus said to him, "How can these things be?"' },
    { id: 'john-3-10', book: 'john', chapter: 3, verse: 10, text: 'Jesus answered him, "Are you the teacher of Israel and yet you do not understand these things?"' },
    { id: 'john-3-11', book: 'john', chapter: 3, verse: 11, text: '"Truly, truly, I say to you, we speak of what we know, and bear witness to what we have seen, but you do not receive our testimony."' },
    { id: 'john-3-12', book: 'john', chapter: 3, verse: 12, text: '"If I have told you earthly things and you do not believe, how can you believe if I tell you heavenly things?"' },
    { id: 'john-3-13', book: 'john', chapter: 3, verse: 13, text: '"No one has ascended into heaven except he who descended from heaven, the Son of Man."' },
    { id: 'john-3-14', book: 'john', chapter: 3, verse: 14, text: '"And as Moses lifted up the serpent in the wilderness, so must the Son of Man be lifted up,"' },
    { id: 'john-3-15', book: 'john', chapter: 3, verse: 15, text: '"that whoever believes in him may have eternal life."' },
    { id: 'john-3-16', book: 'john', chapter: 3, verse: 16, text: '"For God so loved the world, that he gave his only Son, that whoever believes in him should not perish but have eternal life."' },
    { id: 'john-3-17', book: 'john', chapter: 3, verse: 17, text: '"For God did not send his Son into the world to condemn the world, but in order that the world might be saved through him."' },
    { id: 'john-3-18', book: 'john', chapter: 3, verse: 18, text: '"Whoever believes in him is not condemned, but whoever does not believe is condemned already, because he has not believed in the name of the only Son of God."' },
    { id: 'john-3-19', book: 'john', chapter: 3, verse: 19, text: '"And this is the judgment: the light has come into the world, and people loved the darkness rather than the light because their works were evil."' },
    { id: 'john-3-20', book: 'john', chapter: 3, verse: 20, text: '"For everyone who does wicked things hates the light and does not come to the light, lest his works should be exposed."' },
    { id: 'john-3-21', book: 'john', chapter: 3, verse: 21, text: '"But whoever does what is true comes to the light, so that it may be clearly seen that his works have been carried out in God."' },
  ],
  'psalms-23': [
    { id: 'psalms-23-1', book: 'psalms', chapter: 23, verse: 1, text: 'The Lord is my shepherd; I shall not want.' },
    { id: 'psalms-23-2', book: 'psalms', chapter: 23, verse: 2, text: 'He makes me lie down in green pastures. He leads me beside still waters.' },
    { id: 'psalms-23-3', book: 'psalms', chapter: 23, verse: 3, text: 'He restores my soul. He leads me in paths of righteousness for his name\'s sake.' },
    { id: 'psalms-23-4', book: 'psalms', chapter: 23, verse: 4, text: 'Even though I walk through the valley of the shadow of death, I will fear no evil, for you are with me; your rod and your staff, they comfort me.' },
    { id: 'psalms-23-5', book: 'psalms', chapter: 23, verse: 5, text: 'You prepare a table before me in the presence of my enemies; you anoint my head with oil; my cup overflows.' },
    { id: 'psalms-23-6', book: 'psalms', chapter: 23, verse: 6, text: 'Surely goodness and mercy shall follow me all the days of my life, and I shall dwell in the house of the Lord forever.' },
  ],
  'romans-8': [
    { id: 'romans-8-1', book: 'romans', chapter: 8, verse: 1, text: 'There is therefore now no condemnation for those who are in Christ Jesus.' },
    { id: 'romans-8-2', book: 'romans', chapter: 8, verse: 2, text: 'For the law of the Spirit of life has set you free in Christ Jesus from the law of sin and death.' },
    { id: 'romans-8-3', book: 'romans', chapter: 8, verse: 3, text: 'For God has done what the law, weakened by the flesh, could not do. By sending his own Son in the likeness of sinful flesh and for sin, he condemned sin in the flesh,' },
    { id: 'romans-8-4', book: 'romans', chapter: 8, verse: 4, text: 'in order that the righteous requirement of the law might be fulfilled in us, who walk not according to the flesh but according to the Spirit.' },
    { id: 'romans-8-5', book: 'romans', chapter: 8, verse: 5, text: 'For those who live according to the flesh set their minds on the things of the flesh, but those who live according to the Spirit set their minds on the things of the Spirit.' },
    { id: 'romans-8-6', book: 'romans', chapter: 8, verse: 6, text: 'For to set the mind on the flesh is death, but to set the mind on the Spirit is life and peace.' },
    { id: 'romans-8-28', book: 'romans', chapter: 8, verse: 28, text: 'And we know that for those who love God all things work together for good, for those who are called according to his purpose.' },
    { id: 'romans-8-38', book: 'romans', chapter: 8, verse: 38, text: 'For I am sure that neither death nor life, nor angels nor rulers, nor things present nor things to come, nor powers,' },
    { id: 'romans-8-39', book: 'romans', chapter: 8, verse: 39, text: 'nor height nor depth, nor anything else in all creation, will be able to separate us from the love of God in Christ Jesus our Lord.' },
  ],
  'philippians-4': [
    { id: 'philippians-4-4', book: 'philippians', chapter: 4, verse: 4, text: 'Rejoice in the Lord always; again I will say, rejoice.' },
    { id: 'philippians-4-5', book: 'philippians', chapter: 4, verse: 5, text: 'Let your reasonableness be known to everyone. The Lord is at hand.' },
    { id: 'philippians-4-6', book: 'philippians', chapter: 4, verse: 6, text: 'Do not be anxious about anything, but in everything by prayer and supplication with thanksgiving let your requests be made known to God.' },
    { id: 'philippians-4-7', book: 'philippians', chapter: 4, verse: 7, text: 'And the peace of God, which surpasses all understanding, will guard your hearts and your minds in Christ Jesus.' },
    { id: 'philippians-4-8', book: 'philippians', chapter: 4, verse: 8, text: 'Finally, brothers, whatever is true, whatever is honorable, whatever is just, whatever is pure, whatever is lovely, whatever is commendable, if there is any excellence, if there is anything worthy of praise, think about these things.' },
    { id: 'philippians-4-13', book: 'philippians', chapter: 4, verse: 13, text: 'I can do all things through him who strengthens me.' },
  ],
  'genesis-1': [
    { id: 'genesis-1-1', book: 'genesis', chapter: 1, verse: 1, text: 'In the beginning, God created the heavens and the earth.' },
    { id: 'genesis-1-2', book: 'genesis', chapter: 1, verse: 2, text: 'The earth was without form and void, and darkness was over the face of the deep. And the Spirit of God was hovering over the face of the waters.' },
    { id: 'genesis-1-3', book: 'genesis', chapter: 1, verse: 3, text: 'And God said, "Let there be light," and there was light.' },
    { id: 'genesis-1-4', book: 'genesis', chapter: 1, verse: 4, text: 'And God saw that the light was good. And God separated the light from the darkness.' },
    { id: 'genesis-1-5', book: 'genesis', chapter: 1, verse: 5, text: 'God called the light Day, and the darkness he called Night. And there was evening and there was morning, the first day.' },
    { id: 'genesis-1-26', book: 'genesis', chapter: 1, verse: 26, text: 'Then God said, "Let us make man in our image, after our likeness. And let them have dominion over the fish of the sea and over the birds of the heavens and over the livestock and over all the earth and over every creeping thing that creeps on the earth."' },
    { id: 'genesis-1-27', book: 'genesis', chapter: 1, verse: 27, text: 'So God created man in his own image, in the image of God he created him; male and female he created them.' },
  ],
}

export function getVerses(book: string, chapter: number): Verse[] {
  return MOCK_VERSES[`${book}-${chapter}`] ?? []
}

export function searchVerses(query: string): Verse[] {
  const q = query.toLowerCase()
  return Object.values(MOCK_VERSES)
    .flat()
    .filter(v => v.text.toLowerCase().includes(q) || `${v.book} ${v.chapter}:${v.verse}`.toLowerCase().includes(q))
    .slice(0, 20)
}
