'use strict';

global.RawiTest.registerAsync('async fail fixture', function () {
  return new Promise(function (resolve, reject) {
    setTimeout(function () {
      reject(new Error('fixture rejection'));
    }, 20);
  });
});
