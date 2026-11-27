import { say } from '../data/words.js'

/**
 * Taking an invitation on a workspace's own domain — `ui/app/hostJoin.tsx`,
 * No
 * password anywhere: a name and an email, and a code where one is needed.
 */
export const HOST_JOIN = say({
  join: [(where: string) => `Join ${where}`, (where: string) => `Rejoindre ${where}`],
  yourName: ['Your name', 'Votre nom'],
  email: ['Email', 'Adresse e-mail'],
  joinButton: ['Join', 'Rejoindre'],
  joining: ['Joining…', 'Un instant…'],
  enterBoth: ['Enter your name and email.', 'Saisissez votre nom et votre adresse e-mail.'],
  enterName: ['Enter your name.', 'Saisissez votre nom.'],
  sentTo: [
    (email: string) => `We sent a code to ${email}. Enter it to join. It works for ten minutes.`,
    (email: string) => `Nous avons envoyé un code à ${email}. Saisissez-le pour rejoindre l’espace. Il est valable dix minutes.`,
  ],
  code: ['Code from the email', 'Code reçu par e-mail'],
  appCode: ['Code from your app, or a recovery code', 'Code de votre application, ou code de secours'],
  wrongCode: [
    'That code didn’t work. Check it, or ask for a new one.',
    'Ce code n’a pas fonctionné. Vérifiez-le, ou demandez-en un nouveau.',
  ],
  otherAddress: ['Use another email', 'Utiliser une autre adresse e-mail'],
  newCode: ['Send a new code', 'Envoyer un nouveau code'],
  tooMany: ['Too many attempts. Try again in a few minutes.', 'Trop de tentatives. Réessayez dans quelques minutes.'],
  couldntJoin: ['Couldn’t join. Try again.', 'Impossible de rejoindre l’espace de travail. Réessayez.'],
  confirmFirst: [
    'Confirm your email first. Open the link we sent you, then come back to this invitation.',
    'Confirmez d’abord votre adresse e-mail. Ouvrez le lien que nous vous avons envoyé, puis revenez à cette invitation.',
  ],
  noLonger: [
    'This invitation is no longer valid. Ask the person who invited you for a new one.',
    'Cette invitation n’est plus valide. Demandez-en une nouvelle à la personne qui vous a invité.',
  ],
  sameEmail: ['Already use Tuff? Use the same email.', 'Vous utilisez déjà Tuff ? Utilisez la même adresse e-mail.'],
})
