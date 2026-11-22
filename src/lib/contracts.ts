export const ESCROW_ADDRESS = "0xa8c9D1d2CB862f3C91E3C4cBbA7B8DE0fd5Bf8E9";

export const USDC_ADDRESS = "0x534b2f3A21130d7a60830c2Df862319e593943A3";

export const ESCROW_ABI = [
    "function createBounty(uint256 amount, uint256 deadline) external",
    "function bountyCount() view returns (uint256)",
    "function bounties(uint256) view returns (address creator, uint256 amount, bool active, uint256 deadline)",
    "function approveBounty(uint256 bountyId, address hunter) external",
    "function refundExpired(uint256 bountyId) external",
    "function reject(uint256 bountyId, address hunter) external",
    "function platform() view returns (address)",
    "function owner() view returns (address)",
    "function setPlatform(address _platform) external",
    "event BountyCreated(uint256 indexed bountyId, address indexed creator, uint256 amount, uint256 deadline)",
    "event BountyApproved(uint256 indexed bountyId, address indexed hunter, uint256 amount)",
    "event BountyRefunded(uint256 indexed bountyId, address indexed creator, uint256 amount)",
    "event SubmissionRejected(uint256 indexed bountyId, address indexed hunter)",
    "event PlatformUpdated(address platform)"
];

export const ERC20_ABI = [
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function decimals() view returns (uint8)"
];