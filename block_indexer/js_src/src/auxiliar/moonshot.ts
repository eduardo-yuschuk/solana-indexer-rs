export const getCurvePercentage = (priceInSol: number): number => {
  const coefficients = [
    1.64495936e62, -3.59104058e56, 3.36157604e50, -1.76514162e44, 5.7136059e37,
    -1.18124449e31, 1.56700631e24, -1.3130554e17, 6.80386291e9, -1.15101449e2,
  ];

  const percentage =
    coefficients[0] * Math.pow(priceInSol, 9) +
    coefficients[1] * Math.pow(priceInSol, 8) +
    coefficients[2] * Math.pow(priceInSol, 7) +
    coefficients[3] * Math.pow(priceInSol, 6) +
    coefficients[4] * Math.pow(priceInSol, 5) +
    coefficients[5] * Math.pow(priceInSol, 4) +
    coefficients[6] * Math.pow(priceInSol, 3) +
    coefficients[7] * Math.pow(priceInSol, 2) +
    coefficients[8] * priceInSol +
    coefficients[9];

  return percentage;
};
