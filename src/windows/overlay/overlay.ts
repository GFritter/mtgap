import {countOfObject, hexToRgbA, jsonParse, sumOfObject} from 'root/lib/func';
import {sortcards} from 'root/lib/sortcards';
import {color, manafont, rarcolor, supercls, typecolorletter} from 'root/lib/utils';
import {Card} from 'root/models/cards';
import {Match} from 'root/models/match';
import {Metadata} from 'root/models/metadata';
import {onMessageFromIpcMain} from 'root/windows/messages';
// tslint:disable-next-line: no-import-side-effect
import 'root/windows/overlay/overlay.css';

const MainOut = document.getElementById('MainOut') as HTMLElement;
const OpponentOut = document.getElementById('OpponentOut') as HTMLElement;
const CardHint = document.getElementById('CardHint') as HTMLElement;
const highlightTimeout = 3000;

const currentMatch = new Match();
let metaData: Metadata | undefined;
const superclasses = ['sorcery', 'creature', 'land'];

function makeCard(cid: number, num: number, mode: string, side: boolean): string {
  const BasicLand = 34;
  if (!metaData) {
    return '';
  }
  const cardsdb = metaData.allcards;

  const name = cardsdb[cid]['name'];
  const mtgaId = cardsdb[cid]['mtga_id'];
  const rarity = cardsdb[cid]['rarity'];
  const mana = cardsdb[cid]['mana'];
  const thumb = cardsdb[cid]['art'];
  const colorarr = cardsdb[cid]['colorarr'];
  const island = cardsdb[cid]['is_land'];
  const supercls = cardsdb[cid]['supercls'];
  const colorindicator = cardsdb[cid]['colorindicator'];
  const slug = cardsdb[cid]['slug'];
  const flavor = cardsdb[cid]['flavor'];

  let bgcolor = 'linear-gradient(to bottom,';

  let clnum = 0;
  let lastcolor = '';

  if (side) {
    currentMatch.totalCards += num;
    if (!currentMatch.cardsBySuperclass[supercls]) {
      currentMatch.cardsBySuperclass[supercls] = num;
    } else {
      currentMatch.cardsBySuperclass[supercls] += num;
    }
  }

  //let manaj: {[index: string]: number} = {'': 0};

  const manaj: {[index: string]: number} = colorarr !== '' && colorarr !== '[]' ? jsonParse(colorarr) : jsonParse(mana);

  if (manaj) {
    const allcol = countOfObject(manaj);
    Object.keys(manaj).forEach((clr: string) => {
      if (clr !== 'Colorless' || +allcol === 0) {
        if (clr.indexOf('/') === -1) {
          if (manafont[clr.toLowerCase()] !== '') {
            bgcolor += (bgcolor !== 'linear-gradient(to bottom,' ? ',' : '') + hexToRgbA(`#${typecolorletter[clr]}`);
            lastcolor = hexToRgbA(`#${typecolorletter[clr]}`);
            clnum++;
          } else {
            const splitclrs: string[] = clr.split('/');
            splitclrs.forEach(cl => {
              bgcolor += (bgcolor !== 'linear-gradient(to bottom,' ? ',' : '') + hexToRgbA(`#${typecolorletter[cl]}`);
              lastcolor = hexToRgbA(`#${typecolorletter[cl]}`);
              clnum++;
            });
          }
        }
      } else if (clr === 'Colorless' && +sumOfObject(manaj) === +manaj['Colorless']) {
        bgcolor += `${hexToRgbA('#ababab')},${hexToRgbA('#ababab')}`;
      }
    });

    if (clnum === 1) {
      bgcolor += (bgcolor !== 'linear-gradient(to bottom,' ? ',' : '') + lastcolor;
    }
  } else {
    bgcolor += (bgcolor !== 'linear-gradient(to bottom,' ? ',' : '') + hexToRgbA(`#${typecolorletter.Colorless}`);
    lastcolor = hexToRgbA(`#${typecolorletter.Colorless}`);
    clnum++;
  }
  bgcolor += ') 1 100%';

  let manas = '';

  color.forEach(clr => {
    if (manaj && manaj[clr] > 0 && +island === 0) {
      if (clr !== 'Colorless') {
        for (let i = 0; i < manaj[clr]; i++) {
          manas += `
              <span class="ManaGroup ms ms-${manafont[clr.toLowerCase()]}"
              ></span>`;
        }
      } else {
        manas += `<span class="ManaGroup ms ms-${manaj[clr]}"></span>`;
      }
    }
  });

  return `
<div class="DcDrow" data-cid="${cid}" id="card${mtgaId}${side ? 'me' : 'opp'}">
<div class="CardSmallPic" style="border-image:${bgcolor}; background:url('https://mtgarena.pro/mtg/pict/thumb/${thumb}') 50% 50%">
</div>
<div class="CNameManaWrap">
<div class="CCmana">
${manas} ${manas !== '' ? '|' : ''} <span class="ms ms-${superclasses[cardsdb[cid]['supercls']]}">
</div>
<div class="CName">${name}</div>
</div>
<div class="Copies" id="cardnum${mtgaId}${side ? 'me' : 'opp'}">
${side ? `${num} | ${num}` : num}</div>
</div>`;
}

const updateOppDeck = (highlight: number[]) => {
  if (!metaData) {
    return '';
  }
  const SortLikeMTGA = 11;
  const meta = metaData;
  let output = '';
  const oppDeck: {[index: number]: number} = {};
  const forsort: {[index: number]: Card} = {};
  /*console.log('???');
  console.log(currentMatch.decks.opponent);*/
  Object.keys(currentMatch.decks.opponent).forEach(OppMtgaCid => {
    //console.log(OppMtgaCid);
    const cid = meta.mtgatoinnerid[+OppMtgaCid];
    oppDeck[+cid] = currentMatch.decks.opponent[+OppMtgaCid];
    forsort[+cid] = meta.allcards[+cid];
  });
  sortcards(forsort, true, SortLikeMTGA).forEach(cid => {
    output += makeCard(+cid[0], oppDeck[+cid[0]], 'battle', false);
  });

  OpponentOut.innerHTML = output;
  OpponentOut.classList.remove('hidden');

  highlight.forEach(mtgaid => {
    const crdEl: HTMLElement | null = document.getElementById(`card${mtgaid}opp`);
    if (crdEl) {
      crdEl.classList.add('highlightCard');
    }
  });

  setTimeout(() => {
    Array.from(document.getElementsByClassName('highlightCard')).forEach(el => {
      el.classList.remove('highlightCard');
    });
  }, highlightTimeout);
};

const genBattleCardNum = (mtgaid: number) => {
  /*console.log(currentMatch.totalCards);
  console.log(currentMatch.cardsBySuperclass);*/

  if (!metaData) {
    return '';
  }

  const cid = metaData.mtgatoinnerid[+mtgaid];
  const num = currentMatch.myFullDeck.find(fd => fd.card === +cid);
  if (!num) {
    return '';
  }

  const numleft = currentMatch.decks.me[+mtgaid] > 0 ? num.cardnum - currentMatch.decks.me[+mtgaid] : num.cardnum;
  const cardsPlayed = sumOfObject(currentMatch.decks.me);
  const draw = (100 * (numleft / (currentMatch.totalCards - cardsPlayed))).toFixed(2);
  //console.log(numleft + '/' + currentMatch.totalCards + '/' + cardsPlayed);
  const numbers = `<div class="uppernum"><div class="leftuppernum">${num.cardnum}</div> ${numleft}</div><div class="bottomnum">${draw}%</div>`;
  if (numleft === 0) {
    const crdEl: HTMLElement | null = document.getElementById(`card${mtgaid}me`);
    if (crdEl) {
      crdEl.classList.add('outCard');
    }
  }
  return numbers;
};

const updateDeck = (highlight: number[]) => {
  if (!metaData) {
    return '';
  }
  const meta = metaData;

  currentMatch.myFullDeck.forEach(card => {
    const mtgaid = meta.allcards[+card.card].mtga_id;
    const crdTxtEl: HTMLElement | null = document.getElementById(`cardnum${mtgaid}me`);
    if (crdTxtEl !== null) {
      crdTxtEl.innerHTML = genBattleCardNum(mtgaid);
    }
  });
  highlight.forEach(mtgaid => {
    const cid = meta.mtgatoinnerid[+mtgaid];
    const scls = meta.allcards[+cid].supercls;
    if (!currentMatch.cardsBySuperclassLeft[scls]) {
      currentMatch.cardsBySuperclassLeft[scls] = 1;
    } else {
      currentMatch.cardsBySuperclassLeft[scls]++;
    }

    const crdEl: HTMLElement | null = document.getElementById(`card${mtgaid}me`);
    if (crdEl) {
      crdEl.classList.add('highlightCard');
      setTimeout(() => {
        Array.from(document.getElementsByClassName('highlightCard')).forEach(el => {
          el.classList.remove('highlightCard');
        });
      }, highlightTimeout);
    }
  });

  for (let scls = 0; scls <= 2; scls++) {
    const sclsEl: HTMLElement | null = document.getElementById(`scls${scls}`);
    if (sclsEl) {
      const numleft = currentMatch.cardsBySuperclass[scls] - currentMatch.cardsBySuperclassLeft[scls];
      const cardsPlayed = sumOfObject(currentMatch.decks.me);
      const draw = (100 * (numleft / (currentMatch.totalCards - cardsPlayed))).toFixed(2);
      sclsEl.innerHTML = `<span class="ms ms-${superclasses[scls]}"> ${numleft} | ${draw}%`;
    }
  }
};

const drawDeck = () => {
  if (!metaData) {
    return '';
  }
  const cardsdb = metaData.allcards;

  let output = `<div class="deckName">${currentMatch.humanname}</div>`;
  currentMatch.myFullDeck.forEach(card => {
    output += makeCard(card.card, card.cardnum, 'battle', true);
  });
  output += '<div class="deckBottom">';
  for (let scls = 0; scls <= 2; scls++) {
    output += `<div id="scls${scls}" class="scls"></div>`;
  }
  output += '</div>';
  MainOut.innerHTML = output;
  MainOut.classList.remove('hidden');

  const AllCards = document.getElementsByClassName('DcDrow');
  Array.from(AllCards).forEach(theCard => {
    theCard.addEventListener('mouseenter', (event: Event) => {
      const cl: HTMLElement = event.target as HTMLElement;
      const cid = cl.getAttribute('data-cid') as string;
      const src = `https://mtgarena.pro/mtg/pict/${
        cardsdb[+cid].has_hiresimg === 1 ? `mtga/card_${cardsdb[+cid].mtga_id}_EN.png` : cardsdb[+cid].pict
      }`;
      CardHint.innerHTML = `<img src="${src}" class="CardClass" />`;

      const pos = cl.getBoundingClientRect();
      const moPos = MainOut.getBoundingClientRect();
      const cardPosHeight = 268;
      const maxTop = moPos.top + moPos.height;
      const hintTop = pos.top + cardPosHeight < maxTop ? pos.top : pos.bottom - cardPosHeight;

      CardHint.style.left = `${pos.left + pos.width}px`;

      CardHint.style.top = `${hintTop}px`;

      CardHint.classList.remove('hidden');
    });
    theCard.addEventListener('mouseleave', () => {
      CardHint.classList.add('hidden');
    });
  });
};

onMessageFromIpcMain('set-metadata', meta => {
  metaData = meta;
});

onMessageFromIpcMain('match-started', newMatch => {
  currentMatch.matchId = newMatch.matchId;
  currentMatch.ourUid = newMatch.uid;
  currentMatch.myTeamId = newMatch.seatId;
  currentMatch.GameNumber = newMatch.gameNumber;
  currentMatch.myFullDeck = newMatch.deckstruct;
  currentMatch.humanname = newMatch.humanname;
  drawDeck();
});

onMessageFromIpcMain('mulligan', res => {
  if (res) {
    currentMatch.mulligan();
    const AllCards = document.getElementsByClassName('DcDrow');
    Array.from(AllCards).forEach(theCard => theCard.classList.remove('outCard'));
    updateDeck([]);
  }
});

onMessageFromIpcMain('match-over', () => currentMatch.over());

onMessageFromIpcMain('card-played', arg => {
  const res = currentMatch.cardplayed({
    grpId: arg.grpId,
    instanceId: arg.instanceId,
    ownerSeatId: arg.ownerSeatId,
    zoneId: arg.zoneId,
  });
  if (res.myDeck) {
    if (res.affectedcards.length > 0) {
      updateDeck(res.affectedcards);
    }
  } else {
    updateOppDeck(res.affectedcards);
  }
});

MainOut.addEventListener('mouseenter', () => {
  // tslint:disable-next-line: no-console
  console.log('!!!');
});
