/* eslint-disable */
import '@babel/polyfill';

import { login, logout } from './login';
import { updateSettings } from './updateSettings';
import { addToCart } from './cart';

// ELEMENT
const $formLogin = document.querySelector('.form--login');
const $logout = document.querySelector('.nav__el--logout');
const $formUserData = document.querySelector('.form-user-data');
const $formUserPassword = document.querySelector('.form-user-password');
const $cardContainer = document.querySelector('.card-container');

if ($formLogin) {
  $formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    login(email, password);
  });
}

if ($logout) {
  $logout.addEventListener('click', logout);
}

if ($formUserData) {
  $formUserData.addEventListener('submit', async (e) => {
    e.preventDefault();
    console.log('PHOTO', document.getElementById('photo').files[0]);
    const form = new FormData();
    form.append('name', document.getElementById('name').value);
    form.append('email', document.getElementById('email').value);
    form.append('photo', document.getElementById('photo').files[0]);

    updateSettings(form, 'data');
  });
}

if ($formUserPassword) {
  $formUserPassword.addEventListener('submit', async (e) => {
    e.preventDefault();
    document.querySelector('.btn--password').textContent = 'Updatting ...';
    const passwordCurrent = document.getElementById('password-current').value;
    const password = document.getElementById('password').value;
    const passwordConfirm = document.getElementById('password-confirm').value;

    await updateSettings(
      { passwordCurrent, password, passwordConfirm },
      'password'
    );

    document.querySelector('.btn--password').textContent = 'Save password';
    document.getElementById('password-current').value = '';
    document.getElementById('password').value = '';
    document.getElementById('password-confirm').value = '';
  });
}

if ($cardContainer) {
  $cardContainer.addEventListener('click', async (e) => {
    const $addToCart = e.target.closest('.add-to-cart');
    if ($addToCart) {
      const { tourId } = $addToCart.dataset;
      $addToCart.textContent = 'Adding...';
      await addToCart(tourId);
      console.log('dcm');
    }
  });
}
