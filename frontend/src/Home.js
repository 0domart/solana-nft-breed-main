import React, { useEffect, useCallback, useState } from 'react';
import { isMobile } from 'react-device-detect';
import * as anchor from "@project-serum/anchor";
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import {
    PublicKey,
    SystemProgram
} from '@solana/web3.js';

import * as borsh from 'borsh';

import {
    Container,
    Row,
    Col,
    Card,
    CardImg,
    CardHeader,
    CardTitle,
    Button,
    CardBody,
    Input,
    CardText
} from 'reactstrap';
import axios from 'axios';
import {
    getParsedNftAccountsByOwner,
    isValidSolanaAddress,
} from "@nfteyez/sol-rayz";

import { TOKEN_PROGRAM_ID, Token } from "@solana/spl-token";
import { getOrCreateAssociatedTokenAccount } from './libs/getOrCreateAssociatedTokenAccount'
import { createTokenAccount } from './libs/createTokenAccount'

import { METADATA_SCHEMA, Metadata } from "./types.ts";
import idl from './assets/nft_breed.json'

import {
    WalletModalProvider,
    WalletMultiButton
} from '@solana/wallet-adapter-react-ui';
import {
    poolPublicKey,
    feeMintPublicKey
} from "./config";

const opts = {
    preflightCommitment: "processed"
}

const programID = new PublicKey(idl.metadata.address);

function randomIntFromInterval(min, max) { // min and max included 
    return Math.floor(Math.random() * (max - min + 1) + min)
}
const Home = () => {

    const [season1Nfts, setSeason1Nfts] = useState([]);
    const [season2Nfts, setSeason2Nfts] = useState([]);
    const [selectedNft1, setSelectedNft1] = useState(null);
    const [selectedNft2, setSelectedNft2] = useState(null);
    const [selectedNft3, setSelectedNft3] = useState(null);
    const [loading, setLoading] = useState(false);
    const [isMinting, setIsMinting] = useState(false);
    const [provider, setProvider] = useState(null);
    const [program, setProgram] = useState(null);

    const { connection } = useConnection();
    const { publicKey, signTransaction } = useWallet();
    const wallet = useWallet();

    async function getProvider() {
        const provider = new anchor.Provider(
            connection, wallet, opts.preflightCommitment,
        );
        return provider;
    }

    const getAllNftData = async (walletPubKey) => {
        try {
            const nfts = await getParsedNftAccountsByOwner({
                publicAddress: walletPubKey,
                connection: connection,
                serialization: true,
            });

            let n = nfts.length;
            for (let i = 0; i < n; i++) {
                var val;
                try {
                    val = await axios.get(nfts[i].data.uri);
                } catch (err) {
                    continue;
                }

                val.mint = nfts[i].mint;

                nfts[i] = val;
            }
            console.log(nfts)
            var season1 = nfts.filter((nft) => {
                var attributes = {};
                nft.data.attributes.map((attribute) => {
                    attributes[attribute.trait_type] = attribute.value;
                })
                if (attributes.season === 1 && attributes.isBreedable === true || true) {
                    return nft;
                }
            })
            setSeason1Nfts(season1);
            var season2 = nfts.filter((nft) => {
                var attributes = {};
                nft.data.attributes.map((attribute) => {
                    attributes[attribute.trait_type] = attribute.value;
                })
                if (attributes.season === 2 && attributes.isBreedable === true || true) {
                    return nft;
                }
            })
            setSeason2Nfts(season2);
            return nfts;
        } catch (error) {
            console.log(error);
        }
    };

    const initialize = async () => {

        var cProvider = await getProvider();
        setProvider(cProvider)
        var cProgram = new anchor.Program(idl, programID, cProvider);
        setProgram(cProgram);

    }

    const getMetadata = async (mint) => {
        const TOKEN_METADATA_PROGRAM_ID = new anchor.web3.PublicKey(
            'metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s',
        );
        return (
            await anchor.web3.PublicKey.findProgramAddress(
                [
                    Buffer.from('metadata'),
                    TOKEN_METADATA_PROGRAM_ID.toBuffer(),
                    mint.toBuffer(),
                ],
                TOKEN_METADATA_PROGRAM_ID,
            )
        )[0];
    };

    const decodeMetadata = (buffer) => {
        return borsh.deserializeUnchecked(METADATA_SCHEMA, Metadata, buffer);
    }

    const handlerBreed = async () => {
        setIsMinting(true);
        const [
            _poolSigner,
            _nonce,
        ] = await PublicKey.findProgramAddress(
            [poolPublicKey.toBuffer()],
            program.programId
        );
        let poolSigner = _poolSigner;
        if (!selectedNft1) {
            alert("Select season1.");
            setIsMinting(false);
            return;
        }

        const [
            family1,
            nonce1
        ] = await PublicKey.findProgramAddress(
            [(new PublicKey(selectedNft1.mint)).toBuffer(), poolPublicKey.toBuffer()],
            program.programId
        )


        let accountInfo = await connection.getParsedAccountInfo(family1);
        if (accountInfo !== null) {
            alert("This season1 NFT already used to breed!");
            setIsMinting(false);
            return;
        }

        if (!selectedNft2) {
            alert("Select season2.");
            setIsMinting(false);
            return;
        }
        const [
            family2,
            nonce2
        ] = await anchor.web3.PublicKey.findProgramAddress(
            [(new PublicKey(selectedNft2.mint)).toBuffer(), poolPublicKey.toBuffer()],
            program.programId
        )

        accountInfo = await connection.getParsedAccountInfo(family2);
        if (accountInfo !== null) {
            alert("This season2 NFT already used to breed!");
            setIsMinting(false);
            return;
        }
        const childNfts = await getParsedNftAccountsByOwner({
            publicAddress: poolSigner,
            connection: connection,
            serialization: true,
        });
        let n = childNfts.length;
        if (n === 0) {
            alert("Pool has not any nfts.");
            setIsMinting(false)
            return;
        }
        for (let i = 0; i < n; i++) {
            var val;
            try {
                val = await axios.get(childNfts[i].data.uri);
            } catch (err) {
                continue;
            }

            val.mint = childNfts[i].mint;

            childNfts[i] = val;
        }

        const rndInt = randomIntFromInterval(0, childNfts.length - 1);
        const childNft = childNfts[rndInt];
        setSelectedNft3(childNft);

        const [
            family3,
            nonce3
        ] = await anchor.web3.PublicKey.findProgramAddress(
            [(new PublicKey(childNft.mint)).toBuffer(), poolPublicKey.toBuffer()],
            program.programId
        )

        let childReceiver = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.publicKey,
            new PublicKey(childNft.mint),
            wallet.publicKey,
            signTransaction
        );

        let tokenAccounts = await connection.getTokenAccountsByOwner(poolSigner, {
            mint: feeMintPublicKey
        });
        if (tokenAccounts.value.length == 0) {
            setIsMinting(false);
            alert("Program didn't initialized yet.");
            return;
        }

        let tmp = await connection.getTokenAccountsByOwner(poolSigner, {
            mint: new PublicKey(childNft.mint)
        })
        if (tmp.value.length === 0) {
            console.log("NFT is not owned by pool.");
            setIsMinting(false);
            return;
        }
        let child1A = tmp.value[0].pubkey;

        let feeAccount = await getOrCreateAssociatedTokenAccount(
            connection,
            wallet.publicKey,
            feeMintPublicKey,
            wallet.publicKey,
            signTransaction
        );

        let feeTokenPoolVault = tokenAccounts.value[0].pubkey;
        await program.rpc.createChild(nonce1, nonce2, nonce3,
            {
                accounts: {
                    breed: poolPublicKey,
                    feeDepositor: feeAccount.address,
                    breedFeeTokenVault: feeTokenPoolVault,
                    nft1: new PublicKey(selectedNft1.mint),
                    nft2: new PublicKey(selectedNft2.mint),
                    family1: family1,
                    family2: family2,
                    family3: family3,
                    child: child1A,
                    childReceiver: childReceiver.address,
                    breedSigner: poolSigner,
                    owner: wallet.publicKey,
                    tokenProgram: TOKEN_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                },
            }
        );
        setIsMinting(false);
    }

    useEffect(() => {
        if (publicKey) {
            initialize()
        }
    }, [publicKey])

    useEffect(async () => {
        if (program) {
            if (program.programId) {
                await getAllNftData(provider.wallet.publicKey);
                setLoading(true);
            }
        }
    }, [program])

    return (
        <div className="main">
            <div className={"header" + (connection ? ' connected' : ' disconnected')}>
                <div className="space">&nbsp;</div>
                <WalletModalProvider>
                    <WalletMultiButton />
                </WalletModalProvider>
            </div>
            <Container>
                <Row>
                    {loading ? (
                        <>
                            <Col xs="12" sm="12" md="4" lg="4" xl="4">
                                <Card className={"nft-card"}>
                                    <CardHeader>Season 1</CardHeader>
                                    <CardBody className="card3">
                                        {/* <CardImg
                                            alt="Card image cap"
                                            src="card1.png"
                                            alt="Not found"
                                            className="card-bg"
                                        /> */}
                                        <CardImg
                                            alt="Card image cap"
                                            src={selectedNft1 ? selectedNft1.data.image : 'nft1_select.png'}
                                            alt="Not found"
                                            className="card-selected-img"
                                        />
                                        <CardTitle>Select Season 1</CardTitle>
                                        <Input type="select" onChange={
                                            (e) => setSelectedNft1(season1Nfts.filter((season1Nft) => season1Nft.mint === e.target.value)[0])
                                        }>
                                            <option>Not selected</option>
                                            {
                                                season1Nfts.map((season1Nft, ind) => {
                                                    return (<option key={ind} value={season1Nft.mint}>{season1Nft.data.name}</option>)
                                                })
                                            }
                                        </Input>
                                        <CardText>{selectedNft1 ? selectedNft1.data.description : ''}</CardText>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col xs="12" sm="12" md="4" lg="4" xl="4">
                                <Card className={"nft-card"}>
                                    <CardHeader>New Season</CardHeader>
                                    <CardBody className="card3">
                                        {/* <CardImg
                                            alt="Card image cap"
                                            src="card3.png"
                                            alt="Not found"
                                            className="card-bg"
                                        /> */}
                                        <CardImg
                                            alt="Card image cap"
                                            src="nft_no_result.png"
                                            src={selectedNft3 ? selectedNft3.data.image : 'nft_no_result.png'}
                                            alt="Not found"
                                            className="card-selected-img"
                                        />
                                        <Button onClick={handlerBreed} disabled={isMinting}>Breed New Season</Button>
                                    </CardBody>
                                </Card>
                            </Col>
                            <Col xs="12" sm="12" md="4" lg="4" xl="4">
                                <Card className={"nft-card"}>
                                    <CardHeader>Season 2</CardHeader>
                                    <CardBody className="card3">
                                        {/* <CardImg
                                            alt="Card image cap"
                                            src="card2.png"
                                            alt="Not found"
                                            className="card-bg"
                                        /> */}
                                        <CardImg
                                            alt="Card image cap"
                                            src={selectedNft2 ? selectedNft2.data.image : 'nft2_select.png'}
                                            alt="Not found"
                                            className="card-selected-img"
                                        />
                                        <CardTitle>Select Season 2</CardTitle>
                                        <Input type="select" onChange={
                                            (e) => setSelectedNft2(season2Nfts.filter((season2Nft) => season2Nft.mint === e.target.value)[0])
                                        }>
                                            <option>Not selected</option>
                                            {
                                                season2Nfts.map((season2Nft, ind) => {
                                                    return (<option key={ind} value={season2Nft.mint}>{season2Nft.data.name}</option>)
                                                })
                                            }
                                        </Input>
                                        <CardText>{selectedNft2 ? selectedNft2.data.description : ''}</CardText>
                                    </CardBody>
                                </Card>
                            </Col>
                        </>
                    ) : (
                        <>
                            <div id='loading'></div>
                        </>
                    )}
                </Row>
            </Container>
        </div>
    );
};

export default Home;