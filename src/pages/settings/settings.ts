import 'rxjs/add/operator/switchMap';

import {Component} from '@angular/core';
import {FormBuilder} from '@angular/forms';
import {Http,} from '@angular/http';
import {TranslateService} from '@ngx-translate/core';
import {NavController, NavParams} from 'ionic-angular';
import {combineLatest} from 'rxjs/observable/combineLatest';
import {of } from 'rxjs/observable/of';

function domain_from_url(url) {
  var parser = document.createElement('a');
  parser.href = url;
  return parser;
}

import {OBP} from '../../providers/obp';

/**
 * The Settings page is a simple form that syncs with a Settings provider
 * to enable the user to customize settings for the app.
 *
 */
@Component({selector: 'page-settings', templateUrl: 'settings.html'})
export class SettingsPage {
  // Our local settings object
  options: any;
  message: string;
  settingsReady = false;

  loading: boolean = true;
  profileSettings = {page: 'profile', pageTitleKey: 'SETTINGS_PAGE_PROFILE'};

  page: string = 'main';
  pageTitleKey: string = 'SETTINGS_TITLE';
  pageTitle: string;

  subSettings: any = SettingsPage;
  user$: any;
  entitlements$: any;

  domains$: any;
  data: any = {};
  localData: any = {};
  count = 0;
  txcount = 0;
  transactions$: any;

  constructor(
      public navCtrl: NavController, public formBuilder: FormBuilder, public navParams: NavParams,
      public translate: TranslateService, public obp: OBP, public http: Http) {}

  ngOnInit() {
    this.user$ = this.obp.api.getCurrentUser();

    this.domains$ =
        this.obp.api.corePrivateAccountsAllBanks()
            .switchMap((accts: any) => {
              return combineLatest(accts.map((acct) => {
                return this.obp.api.accountById('owner', acct.id, acct.bank_id);
              }));
            })
            .switchMap((accts: any) => {
              let filtered =
                  accts.filter((acc) => acc.views_available.find((view) => view.id === 'owner'));
              return combineLatest(filtered.map((acct) => {
                return this.obp.api.getTransactionsForBankAccount('owner', acct.id, acct.bank_id)
                    .map((txs) => {
                      if (txs && txs.transactions.length) {
                        this.message = `Found ${
                                                this.txcount += txs.transactions.length
                                              } Transactions for Lost Rewards!`;
                      }
                      return txs;
                    });
              }));
            })
            .map(transactions => {

              let txs =
                  transactions.map(({transactions}) => transactions).reduce((a, b) => a.concat(b));
              txs = txs.reduce((a, b) => {
                a[b.other_account.metadata.URL] = [...a[b.other_account.metadata.URL] || [], b];
                return a;
              }, {});
              return Object.keys(txs);
            })
            .switchMap((urls) => {
              this.count = urls.length;
              this.message = `Found ${this.count} Potential Reward Sources`;
              return combineLatest(urls.filter((url) => url !== 'null').map((url) => {
                let parsed = <any>domain_from_url(url);
                return this.http.get(parsed.origin)
                    .catch(() => of ({
                             text: function() {
                               return '';
                             }
                           }))
                    .map((res) => {
                      this.message = `${--this.count - 1} Potential Reward Sources Remain`;
                      return res.text();
                    })
                    .filter((val) => !!val)
                    .map((str) => {
                      let a = str.match(/href="([^\'\"]+)/g);
                      if (a === null) {
                        return [parsed.origin, []];
                      }
                      let b = a.map((val) => val.slice(6))
                                  .filter(
                                      (str) => str.includes('rewards') || str.includes('reward') ||
                                          str.includes('loyalty') || str.includes('membership'));
                      return [parsed.origin, b || []];
                    });
              }));
            })
            .map((payload) => {
              let count = payload
                              .map((pay) => {
                                let count = pay[1].length;
                                return count;
                              })
                              .reduce((a, b) => (a + b), 0);
              this.message = `Found ${count} Unclaimed Reward Sources`;
              this.loading = false;
              return payload;
            });

    // this.domains$.subscribe(() => {
    //   this.loading = false;
    // });
  }

  open(domain: string, links: string[]) {
    links.forEach((link) => {
      // console.log(link);
      if (link[0] === '/') {
        window.open(domain + link);
        return;
      } else {
        window.open(link, '_blank');
      }
    });
  }

  total(vals: any[]) {
    return vals.reduce((a, b) => {
      let c = a + +b.details.value.amount;
      return c;
    }, 0)
  }
}
