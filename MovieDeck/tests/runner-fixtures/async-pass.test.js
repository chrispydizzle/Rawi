'use strict';

global.RawiTest.registerAsync('async pass fixture', function () {
  return new Promise(function (resolve) {
    setTimeout(function () {
      console.log('fixture settled');
      resolve();
    }, 20);
  });
});
