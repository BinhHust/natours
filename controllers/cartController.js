const catchAsync = require('../utils/catchAsync');

exports.addToCart = catchAsync(async (req, res, next) => {
  const tourId = req.params.tourId;

  if (!req.session.cart)
    req.session.cart = {
      items: [],
    };

  const items = req.session.cart.items;

  const tourIndex = items.findIndex((item) => item.tourId === tourId);

  let newQuantity = 1;
  const updatedCartTours = [...items];

  if (tourIndex >= 0) {
    newQuantity = items[tourIndex].quantity + 1;
    updatedCartTours[tourIndex].quantity = newQuantity;
  } else {
    updatedCartTours.push({
      tourId,
      quantity: newQuantity,
    });
  }

  req.session.cart.items = updatedCartTours;

  console.log('ok', updatedCartTours);

  await req.session.save();
  res.redirect(`${req.protocol}://${req.get('host')}/`);
});
