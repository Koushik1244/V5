require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { MONAD_RPC, PRIVATE_KEY } = process.env;

module.exports = {
  solidity: "0.8.20",
  networks: MONAD_RPC && PRIVATE_KEY ? {
    monadTestnet: {
      url: MONAD_RPC,
      accounts: [PRIVATE_KEY],
    },
  } : {},
};
