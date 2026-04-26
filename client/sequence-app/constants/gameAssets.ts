import type { ImageSourcePropType } from 'react-native';

export const gameImages: Record<
  'feltTexture' | 'tableHero' | 'cardsChipsVignette' | 'menuTableBg' | 'botDealerToken',
  ImageSourcePropType
> = {
  feltTexture: require('../assets/images/game/felt-texture.jpg'),
  tableHero: require('../assets/images/game/table-hero.jpg'),
  cardsChipsVignette: require('../assets/images/game/cards-chips-vignette.jpg'),
  menuTableBg: require('../assets/images/game/menu-table-bg.jpg'),
  botDealerToken: require('../assets/images/game/bot-dealer-token.jpg'),
};
