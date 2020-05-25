/*eslint-disable*/
const axios = require('axios');

export const addToCart = async (tourId) => {
  try {
    await axios({
      method: 'GET',
      url: `api/v1/cart/addToCart/${tourId}`,
    });
  } catch (err) {
    console.log(err);
  }
};
