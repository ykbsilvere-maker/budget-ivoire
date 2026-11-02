// Icônes simples et monochromes (Lucide) + logos personnels importés par l'utilisateur.
import type { IconType } from 'react-icons';
import {
  LuHouse, LuZap, LuDroplet, LuGraduationCap, LuLandmark, LuShoppingCart, LuCarTaxiFront, LuSmartphone, LuPill,
  LuHeartHandshake, LuHandHeart, LuSprayCan, LuPercent, LuUtensils, LuPartyPopper, LuShirt, LuTv, LuPackage,
  LuCircleAlert, LuPiggyBank, LuBriefcase, LuStar, LuStore, LuPuzzle, LuKey, LuArrowDownLeft, LuUndo2, LuPlus,
  LuBus, LuFuel, LuBaby, LuDumbbell, LuBook, LuHeart, LuCoins, LuTag, LuChurch, LuWifi, LuBanknote, LuCreditCard,
  LuGift, LuWallet, LuArrowLeftRight, LuBike, LuCar, LuTrainFront, LuPlane, LuShip, LuTruck, LuSofa, LuLamp, LuBed,
  LuWrench, LuHammer, LuPlug, LuFlame, LuCoffee, LuBeer, LuWine, LuPizza, LuApple, LuFish, LuEgg, LuCookie,
  LuCroissant, LuSoup, LuMilk, LuSalad, LuDrumstick, LuStethoscope, LuHospital, LuHeartPulse, LuSyringe,
  LuShoppingBag, LuGem, LuScissors, LuSparkles, LuWatch, LuGlasses, LuUsers, LuCake, LuBackpack, LuPencil, LuLaptop,
  LuGamepad2, LuHeadphones, LuMusic, LuCamera, LuReceipt, LuTrendingUp, LuTrophy, LuTicket, LuFilm, LuTreePalm,
  LuUmbrella, LuDog, LuCat, LuShield, LuPhoneCall, LuMail, LuScale, LuFlower2, LuMoon, LuSprout, LuHandshake,
  LuVolleyball, LuShowerHead, LuWashingMachine, LuHandCoins, LuBriefcaseBusiness, LuCigarette,
} from 'react-icons/lu';
import { cx } from './ui';

export const ICONS: Record<string, IconType> = {
  // Logement
  house: LuHouse, key: LuKey, zap: LuZap, droplet: LuDroplet, flame: LuFlame, plug: LuPlug, sofa: LuSofa, bed: LuBed,
  lamp: LuLamp, clean: LuSprayCan, washer: LuWashingMachine, shower: LuShowerHead, wrench: LuWrench, hammer: LuHammer,
  // Courses & repas
  cart: LuShoppingCart, food: LuUtensils, drumstick: LuDrumstick, fish: LuFish, salad: LuSalad, soup: LuSoup, egg: LuEgg,
  apple: LuApple, milk: LuMilk, croissant: LuCroissant, cookie: LuCookie, pizza: LuPizza, coffee: LuCoffee, beer: LuBeer, wine: LuWine,
  // Transport
  taxi: LuCarTaxiFront, bus: LuBus, car: LuCar, bike: LuBike, fuel: LuFuel, train: LuTrainFront, plane: LuPlane, ship: LuShip, truck: LuTruck,
  // Santé & famille
  pill: LuPill, health: LuStethoscope, hospital: LuHospital, pulse: LuHeartPulse, syringe: LuSyringe, baby: LuBaby,
  family: LuHeartHandshake, users: LuUsers, gift: LuHandHeart, present: LuGift, cake: LuCake, church: LuChurch, moon: LuMoon, heart: LuHeart,
  // École & travail
  school: LuGraduationCap, book: LuBook, backpack: LuBackpack, pencil: LuPencil, work: LuBriefcase, office: LuBriefcaseBusiness,
  laptop: LuLaptop, store: LuStore, handshake: LuHandshake, sprout: LuSprout,
  // Loisirs & style
  party: LuPartyPopper, film: LuFilm, ticket: LuTicket, music: LuMusic, headphones: LuHeadphones, game: LuGamepad2, sport: LuDumbbell,
  ball: LuVolleyball, trophy: LuTrophy, beach: LuTreePalm, umbrella: LuUmbrella, camera: LuCamera, shirt: LuShirt, bag: LuShoppingBag,
  scissors: LuScissors, beauty: LuSparkles, gem: LuGem, watch: LuWatch, glasses: LuGlasses, flower: LuFlower2, dog: LuDog, cat: LuCat, smoke: LuCigarette,
  // Communication & abonnements
  phone: LuSmartphone, call: LuPhoneCall, wifi: LuWifi, tv: LuTv, mail: LuMail,
  // Argent
  cash: LuBanknote, coins: LuCoins, card: LuCreditCard, bank: LuLandmark, wallet: LuWallet, piggy: LuPiggyBank, handcoins: LuHandCoins,
  fees: LuPercent, receipt: LuReceipt, growth: LuTrendingUp, shield: LuShield, law: LuScale,
  // Divers
  tag: LuTag, box: LuPackage, alert: LuCircleAlert, star: LuStar, puzzle: LuPuzzle,
  // Usage interne
  in: LuArrowDownLeft, refund: LuUndo2, plus: LuPlus, transfer: LuArrowLeftRight,
};

/** Icônes proposées dans le sélecteur, rangées par thème. */
export const ICON_SECTIONS: { name: string; keys: string[] }[] = [
  { name: 'Logement', keys: ['house', 'key', 'zap', 'droplet', 'flame', 'plug', 'sofa', 'bed', 'lamp', 'clean', 'washer', 'shower', 'wrench', 'hammer'] },
  { name: 'Courses & repas', keys: ['cart', 'food', 'drumstick', 'fish', 'salad', 'soup', 'egg', 'apple', 'milk', 'croissant', 'cookie', 'pizza', 'coffee', 'beer', 'wine'] },
  { name: 'Transport', keys: ['taxi', 'bus', 'car', 'bike', 'fuel', 'train', 'plane', 'ship', 'truck'] },
  { name: 'Santé & famille', keys: ['pill', 'health', 'hospital', 'pulse', 'syringe', 'baby', 'family', 'users', 'gift', 'present', 'cake', 'church', 'moon', 'heart'] },
  { name: 'École & travail', keys: ['school', 'book', 'backpack', 'pencil', 'work', 'office', 'laptop', 'store', 'handshake', 'sprout'] },
  { name: 'Loisirs & style', keys: ['party', 'film', 'ticket', 'music', 'headphones', 'game', 'sport', 'ball', 'trophy', 'beach', 'umbrella', 'camera', 'shirt', 'bag', 'scissors', 'beauty', 'gem', 'watch', 'glasses', 'flower', 'dog', 'cat', 'smoke'] },
  { name: 'Téléphone & abonnements', keys: ['phone', 'call', 'wifi', 'tv', 'mail'] },
  { name: 'Argent', keys: ['cash', 'coins', 'card', 'bank', 'wallet', 'piggy', 'handcoins', 'fees', 'receipt', 'growth', 'shield', 'law'] },
  { name: 'Divers', keys: ['tag', 'box', 'alert', 'star', 'puzzle'] },
];
export const ICON_CHOICES = ICON_SECTIONS.flatMap((s) => s.keys);

/** Icône d'une catégorie / d'un portefeuille : image importée, sinon icône simple, sinon initiales. */
export function Glyph({
  icon, logo, label, size = 40, active, className, plain,
}: { icon?: string; logo?: string; label?: string; size?: number; active?: boolean; className?: string; plain?: boolean }) {
  const Ico = icon ? ICONS[icon] : undefined;
  const radius = Math.round(size * 0.32);
  if (logo)
    return (
      <span className={cx('shrink-0 overflow-hidden bg-white', className)} style={{ width: size, height: size, borderRadius: radius, border: '1px solid var(--s-line)' }}>
        <img src={logo} alt={label ?? ''} className="h-full w-full object-contain" />
      </span>
    );
  return (
    <span
      className={cx('grid shrink-0 place-items-center font-bold', plain ? '' : active ? 'bg-primary text-onprimary' : 'bg-surface2 text-primary', className)}
      style={{ width: size, height: size, borderRadius: radius, fontSize: size * 0.34 }}
    >
      {Ico ? <Ico size={Math.round(size * 0.5)} /> : initials(label ?? '?')}
    </span>
  );
}

export const initials = (name: string) => {
  const words = name.split(/[\s-]+/).filter(Boolean);
  if (words[0] && words[0].length <= 4 && words[0] === words[0].toUpperCase() && /[A-Z]/.test(words[0])) return words[0];
  return words.slice(0, 2).map((w) => w[0]).join('').toUpperCase();
};

/** Réduit une image importée (logo) à 128 px pour un stockage léger sur l'appareil. */
export async function fileToLogo(file: File, max = 128): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.width * s));
    c.height = Math.max(1, Math.round(img.height * s));
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/png');
  } finally {
    URL.revokeObjectURL(url);
  }
}
