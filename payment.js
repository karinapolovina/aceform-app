// Public receiving wallet. No wallet access tokens or notification secrets belong here.
window.ACEFORM_PAYMENT = {
 receiver:'4100116872093109',
 fields(id,amount,method='AC') {
  if(!/^ACEFORM-[A-Za-z0-9-]{8,56}$/.test(id)||!Number.isSafeInteger(amount)||amount<=0||!['AC','PC'].includes(method))throw Error('Invalid payment');
  return {receiver:this.receiver,'quickpay-form':'button',sum:amount.toFixed(2),label:id,paymentType:method};
 }
};
